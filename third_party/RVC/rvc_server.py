import cgi
import os
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from infer.cli import main as rvc_main


ROOT = Path(__file__).resolve().parent
HOST = os.getenv("RVC_SERVER_HOST", "127.0.0.1")
PORT = int(os.getenv("RVC_SERVER_PORT", "8020"))
DEFAULT_MODEL = os.getenv("RVC_MODEL", "")
DEFAULT_INDEX = os.getenv("RVC_INDEX", "")


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/convert":
            self.send_error(404)
            return

        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            self.send_error(400, "multipart/form-data required")
            return

        form = cgi.FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ={
                "REQUEST_METHOD": "POST",
                "CONTENT_TYPE": content_type,
                "CONTENT_LENGTH": self.headers.get("Content-Length", "0"),
            },
        )
        audio = form["audio"] if "audio" in form else None
        if audio is None or not getattr(audio, "file", None):
            self.send_error(400, "audio file required")
            return

        model = str(form.getfirst("model", DEFAULT_MODEL) or DEFAULT_MODEL)
        index = str(form.getfirst("index", DEFAULT_INDEX) or DEFAULT_INDEX)
        index_rate = str(form.getfirst("index_rate", "0.75"))
        f0_method = str(form.getfirst("f0_method", "rmvpe"))
        pitch = str(form.getfirst("pitch", "0"))
        protect = str(form.getfirst("protect", "0.33"))

        if not model:
            self.send_error(400, "RVC_MODEL is required")
            return

        with tempfile.TemporaryDirectory(prefix="rvc-http-") as tmp:
            source = Path(tmp) / "input_audio"
            output = Path(tmp) / "output.wav"
            source.write_bytes(audio.file.read())
            args = [
                "--model", model,
                "--input", str(source),
                "--output", str(output),
                "--pitch", pitch,
                "--f0-method", f0_method,
                "--index-rate", index_rate,
                "--protect", protect,
                "--format", "wav",
                "--overwrite",
            ]
            if index:
                args += ["--index", index]
            try:
                code = rvc_main(args)
                if code != 0 or not output.is_file():
                    self.send_error(500, "RVC inference failed")
                    return
                data = output.read_bytes()
            except Exception as exc:
                self.send_error(500, str(exc))
                return

        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, format, *args):
        print("rvc-server:", format % args)


if __name__ == "__main__":
    print("RVC DirectML server: http://%s:%s" % (HOST, PORT))
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()

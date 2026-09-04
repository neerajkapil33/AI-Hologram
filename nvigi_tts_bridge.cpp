// nvigi_tts_bridge.cpp
//
// Runs NVIGI's TTS (ASqFlow) generation and streams the resulting PCM audio
// to a connected browser over WebSocket, so a Three.js avatar can play it
// and drive lip-sync in real time.
//
// Dependency: IXWebSocket (https://github.com/machinezone/IXWebSocket)
//   vcpkg install ixwebsocket
//
// This builds on the modern C++ wrapper pattern from NVIGI's TTS
// programming guide (core.hpp / tts.hpp / d3d12.hpp).

#include <iostream>
#include <thread>
#include <atomic>
#include <mutex>
#include <vector>

#include <ixwebsocket/IXWebSocketServer.h>

#include <nvigi.h>
#include "nvigi_tts.h"
#include "nvigi_d3d12.h"

#include "core.hpp"
#include "d3d12.hpp"
#include "tts.hpp"

using namespace nvigi::tts;

namespace {

// Keep a thread-safe list of currently connected browser clients so we can
// push audio chunks to whichever one is listening.
std::mutex g_clientsMutex;
std::vector<std::shared_ptr<ix::WebSocket>> g_clients;

void broadcastPCM(const int16_t* samples, size_t count) {
    std::lock_guard<std::mutex> lock(g_clientsMutex);
    if (g_clients.empty() || count == 0) return;

    // Send raw bytes as-is — the browser reads this as an Int16Array.
    const char* bytes = reinterpret_cast<const char*>(samples);
    size_t numBytes = count * sizeof(int16_t);
    std::string payload(bytes, numBytes);

    for (auto& client : g_clients) {
        client->sendBinary(payload);
    }
}

void broadcastSampleRateHeader(int sampleRate) {
    // A tiny JSON control message so the browser knows the sample rate
    // before any binary audio chunks arrive.
    std::lock_guard<std::mutex> lock(g_clientsMutex);
    std::string msg = "{\"type\":\"sampleRate\",\"value\":" + std::to_string(sampleRate) + "}";
    for (auto& client : g_clients) {
        client->send(msg);
    }
}

} // namespace

int main(int argc, char** argv) {
    // ---- 1. Start the WebSocket server the browser will connect to ----
    ix::WebSocketServer server(8787, "0.0.0.0");

    server.setOnClientMessageCallback(
        [](std::shared_ptr<ix::ConnectionState> connectionState,
           ix::WebSocket& webSocket,
           const ix::WebSocketMessagePtr& msg) {
            if (msg->type == ix::WebSocketMessageType::Open) {
                std::lock_guard<std::mutex> lock(g_clientsMutex);
                g_clients.push_back(std::shared_ptr<ix::WebSocket>(&webSocket, [](ix::WebSocket*) {}));
                std::cout << "Browser client connected.\n";
            } else if (msg->type == ix::WebSocketMessageType::Close) {
                std::cout << "Browser client disconnected.\n";
            }
        }
    );

    auto res = server.listen();
    if (!res.first) {
        std::cerr << "Failed to start WebSocket server: " << res.second << "\n";
        return -1;
    }
    server.start();
    std::cout << "TTS bridge listening on ws://localhost:8787\n";

    // ---- 2. Initialize NVIGI core + TTS instance (D3D12 backend example) ----
    nvigi::Core core({
        .sdkPath = "path/to/sdk",   // <-- point this at your bin\x64 folder
        .logLevel = nvigi::LogLevel::eDefault,
        .showConsole = true
    });

    auto deviceAndQueue = nvigi::d3d12::D3D12Helper::create_best_compute_device();
    nvigi::d3d12::D3D12Config d3d12_config = {
        .device = deviceAndQueue.device.Get(),
        .command_queue = deviceAndQueue.compute_queue.Get(),
        .create_committed_resource_callback = nvigi::d3d12::default_create_committed_resource,
        .destroy_resource_callback = nvigi::d3d12::default_destroy_resource
    };

    auto instance = Instance::create(
        ModelConfig{
            .backend = "d3d12",
            .guid = "{16EEB8EA-55A8-4F40-BECE-CE995AF44101}", // GGML FP16 model
            .model_path = "path/to/nvigi.models",              // <-- your models dir
            .num_threads = 8,
            .vram_budget_mb = 2048,
            .warm_up_models = true
        },
        d3d12_config,
        {}, // no Vulkan config needed
        core.loadInterface(),
        core.unloadInterface()
    ).value();

    std::cout << "NVIGI TTS instance ready.\n";

    // ---- 3. Simple loop: read text from stdin, synthesize, stream to browser ----
    // Replace this with wherever your GPT/dialogue pipeline's text actually
    // comes from (e.g. feed it the LLM's response as soon as it's ready).
    std::string line;
    while (std::getline(std::cin, line)) {
        if (line.empty()) continue;

        broadcastSampleRateHeader(22050);

        auto config = RuntimeConfig{}
            .set_speed(1.0f)
            .set_language("en")
            .set_timesteps(16);

        // Blocking generate() with a callback per audio chunk — the callback
        // fires as each chunk is ready, so we can forward it immediately
        // instead of waiting for the whole utterance to finish.
        auto result = instance->generate(
            line,
            "path/to/target_voice.bin", // <-- your reference speaker embedding
            config,
            [](const int16_t* audio, size_t samples, ExecutionState state) -> ExecutionState {
                if (state == ExecutionState::DataPending || state == ExecutionState::Done) {
                    broadcastPCM(audio, samples);
                }
                return state;
            }
        );

        if (!result) {
            std::cerr << "TTS generation error: " << result.error().what() << "\n";
        }
    }

    server.stop();
    return 0;
}

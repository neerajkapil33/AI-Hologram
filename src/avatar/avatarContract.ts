export const ARKIT_52 = [
  'browDownLeft','browDownRight','browInnerUp','browOuterUpLeft','browOuterUpRight',
  'eyeBlinkLeft','eyeBlinkRight','eyeLookDownLeft','eyeLookDownRight','eyeLookInLeft','eyeLookInRight','eyeLookOutLeft','eyeLookOutRight','eyeLookUpLeft','eyeLookUpRight','eyeSquintLeft','eyeSquintRight','eyeWideLeft','eyeWideRight',
  'cheekPuff','cheekSquintLeft','cheekSquintRight','noseSneerLeft','noseSneerRight',
  'jawForward','jawLeft','jawOpen','jawRight',
  'mouthClose','mouthDimpleLeft','mouthDimpleRight','mouthFrownLeft','mouthFrownRight','mouthFunnel','mouthLeft','mouthLowerDownLeft','mouthLowerDownRight','mouthPressLeft','mouthPressRight','mouthPucker','mouthRight','mouthRollLower','mouthRollUpper','mouthShrugLower','mouthShrugUpper','mouthSmileLeft','mouthSmileRight','mouthStretchLeft','mouthStretchRight','mouthUpperUpLeft','mouthUpperUpRight',
  'tongueOut','eyeBlinkLeft','eyeBlinkRight'
] as const;

export const VISeme_ALIASES: Record<string, string[]> = {
  aa: ['viseme_aa','viseme_AA','mouthOpen','jawOpen'],
  ae: ['viseme_ae','mouthStretchLeft','mouthStretchRight'],
  ah: ['viseme_ah','jawOpen','mouthOpen'],
  ao: ['viseme_ao','viseme_O','mouthFunnel'],
  eh: ['viseme_eh','mouthSmileLeft','mouthSmileRight'],
  er: ['viseme_er','mouthPucker'],
  ih: ['viseme_ih','mouthSmileLeft'],
  iy: ['viseme_iy','mouthSmileLeft','mouthSmileRight'],
  oh: ['viseme_oh','viseme_O','mouthFunnel'],
  ou: ['viseme_ou','viseme_OU','mouthPucker'],
  pp: ['viseme_pp','viseme_PP','mouthClose'],
  ff: ['viseme_ff','viseme_FF','mouthFunnel'],
  th: ['viseme_th','viseme_TH','tongueOut'],
  dd: ['viseme_dd','viseme_DD','jawOpen'],
  kk: ['viseme_kk','viseme_KK','jawOpen'],
  ch: ['viseme_ch','viseme_CH','mouthPucker'],
  ss: ['viseme_ss','viseme_SS','mouthStretchLeft','mouthStretchRight'],
  nn: ['viseme_nn','viseme_NN','mouthClose'],
  rr: ['viseme_rr','viseme_RR','mouthPucker'],
  silence: ['mouthClose']
};

export const HUMANOID_BONES = [
  ['hips','pelvis'], ['spine'], ['chest','upperchest'], ['neck'], ['head'],
  ['leftupperarm','left_arm','leftarm'], ['rightupperarm','right_arm','rightarm'],
  ['leftforearm','left_forearm','leftlowerarm'], ['rightforearm','right_forearm','rightlowerarm'],
  ['lefthand','left_hand'], ['righthand','right_hand'],
  ['leftthigh','leftupleg','leftupperleg'], ['rightthigh','rightupleg','rightupperleg'],
  ['leftcalf','leftlowerleg'], ['rightcalf','rightlowerleg'], ['leftfoot'], ['rightfoot']
] as const;

export type AvatarAssetReport = {
  meshes: number;
  skinnedMeshes: number;
  bones: number;
  morphMeshes: number;
  morphTargets: number;
  animations: number;
  humanoidCoreBones: number;
  arkitLikeTargets: number;
  visemeLikeTargets: number;
  productionReady: boolean;
};

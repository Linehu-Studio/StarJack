/** @starjack/engine — 核心检测引擎（isomorphic：CLI 与浏览器共用） */
export * from './types';
export * from './i18n';
export { GitHubClient, GitHubError } from './github/client';
export {
  parseRepoInput,
  collectScanData,
  fetchStarTimeline,
  sampleLogins,
  fetchUserProfiles,
} from './github/collect';
export {
  runEngine,
  runDetectors,
  DETECTORS,
  WEIGHTS,
  ghostScoreOf,
  ghostShareOf,
  computeCurveExtras,
} from './detectors';
export { scan } from './scan';
export { encodeReport, decodeReport, buildShareUrl } from './share/codec';

export default function ReleaseBadge() {
  return (
    <small className="release-badge">
      <a
        href={`https://github.com/joncady/R3F-Table-Tennis/releases/tag/v${__APP_VERSION__}`}
        target="_blank"
        rel="noreferrer"
      >
        v{__APP_VERSION__}
      </a>
      <span title="Build revision"> · {__BUILD_SHA__}</span>
    </small>
  );
}

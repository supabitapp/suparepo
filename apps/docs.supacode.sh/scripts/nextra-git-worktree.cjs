const path = require("path");
const { createRequire } = require("module");

const nextraRequire = createRequire(require.resolve("nextra/package.json"));
const { Repository } = nextraRequire("@napi-rs/simple-git");

const originalPath = Repository.prototype.path;

Repository.prototype.path = function patchedPath() {
  const gitPath = originalPath.call(this);
  if (this.isWorktree && this.isWorktree()) {
    const workdir = this.workdir && this.workdir();
    if (workdir) {
      return path.join(workdir, ".git");
    }
  }
  return gitPath;
};

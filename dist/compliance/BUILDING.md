# 对应源码与构建说明 — 1.5.1

本目录和 `/source.zip` 与网页、Mac arm64、Windows x64 1.5.1 同步分发。自有代码采用 GPL-3.0-or-later；第三方保留各自许可、版权和署名。软件不提供任何担保，详见所附 GPL 第 15–17 节。

## 本应用

解压 source.zip，在项目根目录执行（Node.js 22 或更新版本）：

```sh
npm ci
python3 scripts/fetch-models.py
node scripts/prepare-runtime.cjs
npm test
npm run check
npm run compliance:check
python3 scripts/package-source.py
npm run dev
```

网页使用 dist/，无需运行后端。桌面开发使用 `npm run desktop`；Mac arm64 安装包使用 `npm run desktop:mac`，Windows x64 使用 `npm run desktop:win`。Windows 可在 Windows 构建，也可从 Mac 使用 electron-builder 下载的工具交叉打包；最终仍须在 Windows 验证。安装证书、商店签名或苹果公证不是开源源码包的组成部分；目前发布包没有这类签名。

ONNX 权重采用 MIT，固定下载地址与 SHA-256 在 desktop/models/manifest.json。为避免重复，源码压缩包不内嵌这两份权重，fetch-models.py 会下载并校验。生产桌面运行时使用随源码提供的 ONNX Runtime 1.30.0 原生 CPU 库及 Node/Common JavaScript。prepare-runtime.cjs 核验全部文件散列，不下载、不运行第三方安装脚本。Mac 使用官方 npm 包中的 arm64 原生文件；Windows 将固定提交的 Node binding 在没有 USE_DML/USE_CUDA 等 GPU 宏的条件下编译，链接官方 CPU 发行版。Node/Common 的 JS 仅将包名导入改为相对路径，移除仅用于 npm 安装的依赖元数据；保留原版权与 MIT 声明。Windows 编译工作流在 .github/workflows/native-windows.yml，CMake 在 scripts/native-cpu/；CPU 原包 SHA-256 固定校验，编译产物的来源与校验在 desktop/vendor/onnxruntime/manifest.json。无需系统 Python 运行识别。

`npm test` 不依赖第三方游戏截图。`desktop:smoke` 中的真实皮肤回归需自行提供有权使用的 board-screenshot.jpg、traditional-board.png，放在 evaluation/private/licensing-fixtures/；这些游戏素材和用户实际屏幕、日志均不再分发，也不是构建软件必需的输入。

## Fairy-Stockfish WASM 1.1.12

对应 C++ / JS 胶水 / Makefile 完整源码：sources/fairy-stockfish-nnue.wasm-1.1.12-source.tar.gz。
npm gitHead：b2e693ef1e111233ce3fb40685921708b3276ed6。
原发布二进制包：sources/fairy-stockfish-nnue.wasm-1.1.12-npm.tgz。
发布的 stockfish.js、stockfish.wasm、stockfish.worker.js 均经逐字节核对，未修改。

解压源码，在 Emscripten 2.0.26 环境中构建不内嵌 NNUE 的 SIMD 版本：

```sh
cd fairy-stockfish.wasm-b2e693ef1e111233ce3fb40685921708b3276ed6/src/emscripten
make -C .. emscripten_build ARCH=wasm wasm_simd=yes embedded_nnue=no
```

也可使用同目录 docker-compose.yml 的 emscripten/emsdk:2.0.26 环境。完整说明在源码 src/emscripten/README.md、Makefile 和 misc/。Git 版本信息宏可能因归档没有 .git 而产生警告；这不改变棋规或算法，如需完整版本宏，可从上述固定提交检出 Git 仓库再构建。这里提供上游构建方法，没有声称已在本次重建出逐字节相同的 WASM。

## ffish 0.7.10

对应 C++ / Embind / Makefile 完整源码：sources/ffish-0.7.10-source.tar.gz。
npm gitHead：43b66c8abfebfcab893a3a4c349aa790d18df148。
原发布二进制包：sources/ffish-0.7.10-npm.tgz。发布的 ffish.js、ffish.wasm 未修改且与原包逐字节一致。

```sh
cd Fairy-Stockfish-43b66c8abfebfcab893a3a4c349aa790d18df148/src
make -f Makefile_js build
```

使用 Emscripten 1.39.16，产物在 tests/js/。上游 tests/js/docker-compose.yml、.github/workflows/ffishjs.yml 和 tests/js/README.md 含完整构建/测试方法。两份 GPL 源码归档均含 AUTHORS、Copying.txt 和实际 C/C++ 源码，没有缺失 Git 子模块。

## 其他组件与改动

component-manifest.json 记录组件版本、资产散列、原始地址和本地许可；npm-provenance.json 记录原发布包的完整性核验。

- 识别适配器参考 MIT 声明的 Hugging Face Space 固定版本，已转换为 JavaScript，改为本地 IPC，加入输入检查、置信度判定及合法走法校验。固定模型卡在 evidence/recognition-model-card.md。独立 GitHub 项目的 Apache-2.0 声明不用于替代 Space 的 MIT 声明。
- 字体 LXGW WenKai 根据 SIL OFL 1.1 提供，仅裁出象棋字形并重命名 XQ Recognition；脚本 scripts/subset-vision-font.py，原版权和 OFL 在 licenses/wenkai-ofl.txt。
- 1.5.1 替换旧 xiangqi-83f16c17fe26.nnue。当前文件 xiangqi-c07e94a5c7cb.nnue 在 Fairy-Stockfish 官方下载页列为 Pikafish 开发者训练的 Fairy-Stockfish 网络，权利方为这类网络明确提供 CC0 声明。许可文本及固定声明保留在 licenses/CC0-1.0.txt 与 evidence/。
- OCR 包和语言数据未改动。原生运行库改动和来源如上。补充原有压缩文件提取出的许可证和其底层库声明；JPEG acknowledgement：This software is based in part on the work of the Independent JPEG Group.
- Electron / Chromium / Node / V8 等第三方声明随 Electron 原发行版保留；Mac 位于 app/Contents/Resources，Windows 位于安装目录。NSIS 工具及应用安装器相关许可在 licenses/nsis.txt，当前仅使用其核心和 zlib，不嵌入 nsis-resources 插件。Mac 显式复制 Electron 原版 LICENSE 与 LICENSES.chromium.html，Windows 保留原运行时根目录中的两个许可文件。

若重新分发，应一起提供完整 source.zip、本目录、所有许可和所需模型下载信息；网络发布时，让对应源码与可执行版本同处可获取，并持续保留被分发版本的对应源码。不要把私有截图、凭据、开发日志或 evaluation/private/ 上传到托管。

本次公开源码与安装包同时发布在 https://github.com/seethith/xiangqi-screen-assistant/releases/tag/v1.5.1 。此前未完成整改的私下分发安装包停止分发；历史测试截图和旧 NNUE 不再公开提供。

安装包核验：使用 `象棋屏幕助手 --release-self-test`（Mac 为 app/Contents/MacOS/象棋屏幕助手）检查实际 app://local 下的许可/源码链接、ZIP 内容、模型 IPC 及增强引擎搜索。它使用独立临时配置，不读取用户屏幕；`--model-self-test` 单独核对模型输出尺寸。

## Electron 附带 FFmpeg 的对应源码

Electron 44.5.1 的 DEPS 固定 Chromium 152.0.7977.130；Chromium DEPS 固定 FFmpeg `2b68d2babae73714846961fb0ee47e3b3d2e39a9`。两份原始 DEPS 在 evidence/。FFmpeg 完整对应源码为 sources/ffmpeg-2b68d2babae-source.tar.gz，含 LGPL 文本、源文件、configure、BUILD.gn、生成的架构配置及构建脚本。Electron 的 FFmpeg 补丁为 sources/electron-44.5.1-ffmpeg.patch；该补丁调整 macOS loader path。我们未自行修改随 Electron 提供的 FFmpeg 二进制。

可按 Electron 官方构建文档 https://www.electronjs.org/docs/latest/development/build-instructions-gn 使用 depot_tools / gclient 检出 `electron/electron` 的 `v44.5.1`，执行 `gclient sync --with_branch_heads --with_tags`；此过程按固定 DEPS 获取 Chromium、FFmpeg 并应用 Electron patches。使用该版本 `build/args/release.gn` 的发布配置生成 GN 输出目录，在目标系统运行 `ninja -C out/Release ffmpeg`（目标需 Chromium/Electron 配套工具链）。也可将本地归档的 FFmpeg 源码恢复至 `src/third_party/ffmpeg` 并应用随附 patch 后，使用同一 Chromium 构建系统重建该动态库。Electron 平台架构与 GN 配置应与发布包一致：Mac arm64 或 Windows x64；Windows 需要 Visual Studio 与 Windows SDK。纯 FFmpeg configure 的默认产物不能冒充 Electron 所需的 ABI 配套动态库。

源码取得与构建说明同时保留在此公开仓库和 Release；原版 Electron/Chromium 许可证没有改写，允许按 LGPL 调试、修改及替换对应动态库。此记录不声称本次重新编译了 Electron 或 FFmpeg。

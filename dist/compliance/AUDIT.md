# 1.5.1 发布核查记录

日期：2026-10-20。范围：现有独立网页、Mac arm64 DMG、Windows x64 安装器及随附源码。清单记录 32 个组件/组件组，原始许可、固定模型卡与文件散列可直接下载核对。此记录依据上游公开声明和实际发布文件，不是法律鉴定或上游权属担保。

| 问题 | 本次处理 | 可核对证据 |
| --- | --- | --- |
| GPL 引擎/棋规只有源码外链，本应用源码包缺 C++ | 随站点及安装包提供固定 gitHead 的完整源码归档、Makefile、作者名单和原始 npm 包；应用源码单独提供 | sources/、BUILDING.md、npm-provenance.json；JS/WASM 与原 npm 包逐字节一致 |
| 旧 NNUE 的 CC0 引用不能证明该具体文件的授权 | 移除旧权重，替换为官方目录列为 Pikafish 开发者作品、且作者明确声明 CC0 的 Fairy-Stockfish xiangqi-c07e94a5c7cb.nnue | 固定作者声明、CC0 文本、官方网络目录、SHA-256；测试确认实际输出 NNUE enabled，完成合法搜索 |
| Windows 原生 ONNX 包包含专有 DirectML，且附随声明不完整 | 保留原生推理：Mac 使用官方 arm64 库；Windows 将同版本 Node 接口重编译为 CPU 配置，链接官方 CPU 运行库；仅提供运行所需的 Node/Common JS，保留 MIT 和第三方声明 | desktop/vendor/onnxruntime/manifest.json、安装包无 DirectML/GPU 提供程序、模型 worker 实测 |
| 默认 Windows 安装器内的 WinShell 只标 Freeware | 替换为自有 NSIS 脚本，仅用核心、自带 MUI2 和 zlib；未嵌入任何 nsis-resources 插件 | desktop/installer.nsi、scripts/build-windows.cjs、installer-audit.json、NSIS 编译输出 |
| Tesseract 压缩 JS 的提取许可文件缺失；图像库和 JS 内嵌依赖声明不足 | 恢复原发布包 LICENSE 文件；按固定源码子模块/锁文件补齐 18 个依赖组件的原始声明 | ocr-notices.txt、licenses/ocr-third-party/、licenses/ocr-bundled/、各自 provenance.json |
| 模型仓库 MIT 与独立 GitHub 项目 Apache 元数据容易混淆 | 按实际使用的固定 HF Space MIT 声明记录，保留原始模型卡及精确文件散列，不借用其他仓库许可 | recognition-models.json、evidence/recognition-model-card.md |
| 字体保留/改名义务 | 保留 LXGW 与 Klee 原版权及完整 OFL；已有子集重命名 XQ Recognition | licenses/wenkai-ofl.txt、scripts/subset-vision-font.py |
| 原源码包含第三方游戏截图 | 从公开源包移除，只在本机私有测试目录使用；公开 Node 测试不依赖这些图片 | 源码 ZIP 排除检查、无 evaluation/ 或游戏皮肤图片 |
| Electron 中 LGPL FFmpeg 的对应源码 | 按 Electron / Chromium 固定 DEPS 提供完整 FFmpeg 源码、原 LGPL、Electron patch 及配套构建路径 | sources/ffmpeg-2b68d2babae-source.tar.gz、evidence/ 两份 DEPS、BUILDING.md |
| Mac 打包工具丢弃 Electron 顶层 Chromium 声明 | Mac 显式复制原版 LICENSE 与 LICENSES.chromium.html，Windows 保留原版运行时根目录声明 | 安装包内容核验；Electron 与 Chromium 原文不改写 |
| 旧版对应源码不完整 | 本次 GitHub Release 附应用代码与对应 C++ 源码，安装包也内置；撤回旧权重授权引用，排除游戏截图 | GitHub Release、source.zip、sources/ |

## 验证及适用边界

- 36 项 Node 自动测试通过；包括新 CC0 权重真正启用 NNUE 后输出合法走法，不把静默回退当作加载成功。
- Mac 开发版回归通过：普通/繁体截图精确局面、预训练模型初始及移动局面、空白拒绝、合法走棋跟踪、箭头遮罩、透明箭头窗口及真实 WASM 搜索。测试使用本机既有私有素材，不将它们公开。
- 原生 CPU 模型热运行抽测：本机定位约 7 ms、布局约 63 ms；保留双模型与两条 CPU 计算线程。此为本机测量，不是所有设备性能保证。
- Mac 安装包模型自检通过；两个平台包需逐项核对对应源码与许可、模型及原生运行库散列。最终核验输出在 release/v1.5.1 与 artifacts/。
- Windows 安装器已跨平台编译；当前没有 Windows 真机，不能把编译或静态检查说成 Windows 安装/屏幕采集实测。
- 本轮不扩大已验证的游戏皮肤或识别准确率结论；也不对第三方训练数据、专利或上游作者的实际权属作独立保证。

上游准则：[GNU GPLv3](https://www.gnu.org/licenses/gpl-3.0.html)、[Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0)、[MIT](https://opensource.org/license/mit)、[NSIS 原版许可](https://nsis.sourceforge.io/License)、[WinShell 标注](https://nsis.sourceforge.io/WinShell_plug-in)。固定权重授权入口已在许可证页面与清单中列出。

后续发布必须更新散列、源码归档和源码包，再运行 compliance:check；新增依赖不能自动继承本记录的结论。

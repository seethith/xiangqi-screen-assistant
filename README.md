# 象棋屏幕助手 / 中途局面助手

中国象棋摆盘、本地分析与桌面屏幕助手。支持手动摆局、FEN、截图识别、实时走棋跟踪、悬浮局势和游戏棋盘上的走法箭头。分析和屏幕识别均在本机完成，无需账号或付费 API。

[下载安装包](https://github.com/seethith/xiangqi-screen-assistant/releases/tag/v1.5.1) · [构建说明](dist/compliance/BUILDING.md) · [许可说明](dist/compliance/NOTICE.txt)

## 1.5.1 公开发布

保留 1.5.1 的原生 CPU 识别、双模型、实时跟踪及悬浮箭头。公开发布整理补齐对应源码和许可，替换授权未确认的旧 NNUE，使用明确 CC0 的 Fairy-Stockfish 象棋网络。Windows 的 Node 原生接口以 CPU 配置重新编译，链接官方 CPU 运行库；Mac 沿用上游原生 arm64 运行库。不分发 DirectML 或旧安装器的外部插件。上述包装、许可和权重调整意味着安装包不是早期私下分发包的逐字节副本。1.5.2 已撤回。

- Mac：Apple Silicon / arm64 DMG。
- Windows：x64 安装器，安装到当前用户目录，支持选目录、快捷方式与卸载。已安装早期私下分发的 1.5.1 时，先通过系统卸载旧包再安装；卸载保留用户存档。
- 尚未制作 Intel Mac、Windows ARM 安装包。当前安装包没有商业代码签名或苹果公证。

## 使用

网页可手动摆盘或导入 FEN，选择先走方，开始分析；支持试走、变化、历史及截图 OCR。网页是静态应用，可部署到支持自定义响应头的托管服务。部署 `dist/`，保留 `_headers` 中的 COOP/COEP 设置；GitHub 仓库用于源码与下载，GitHub Pages 本身不能配置这些响应头。

桌面点击“读取屏幕”，选择显示器，切回棋局。Mac 全屏 Edge 推荐显示器模式；首次在系统设置里允许屏幕录制后退出重开。自动定位、识别后先核对棋子、红方朝向、轮到谁走及我方颜色，再确认开始跟踪。必要时手动框定棋盘。悬浮窗显示局势、具体起落点和白话走法，箭头层鼠标穿透；暂停、失去棋盘或证据不足时撤下旧提示。

快捷键：Ctrl / Command + Shift + O 解锁悬浮窗；Ctrl / Command + Shift + X 暂停或继续。结束读取会停止采集。

显示器读取只看到当前可见内容；棋盘被遮挡、动画、特殊皮肤、翻转、重新开局或连续漏掉多步可能需要重新核对。模型不能可靠地从单张截图判断先走方与对局历史。自动更新使用棋规匹配一至两步唯一合法走法。建议来自有限时间搜索，不保证必胜；软件不替用户点击棋子。请按对局平台规则使用。

## 本地开发

需要 Node.js 22+、Python 3.9+。网页运行无需安装 npm 依赖：

```sh
python3 scripts/serve.py
```

打开 `http://127.0.0.1:8767`。完整桌面开发：

```sh
npm ci
python3 scripts/fetch-models.py
node scripts/prepare-runtime.cjs
npm test
npm run check
python3 scripts/compliance-manifest.py
python3 scripts/package-source.py
npm run compliance:check
npm run desktop
```

模型约 40 MiB，下载地址、固定提交与 SHA-256 在 `desktop/models/manifest.json`；安装包已内置模型，无需用户下载。原生运行库及精确清单随源码提供。Windows CPU 接口的可复现编译入口见 `.github/workflows/native-windows.yml` 与 `scripts/native-cpu/`。

打包：`npm run desktop:mac -- --config.directories.output=release/v1.5.1`；`npm run desktop:win`。构建前须重新生成清单、source.zip 并完成检查。更多引擎 C++、Emscripten 与安装器构建方法见 [BUILDING.md](dist/compliance/BUILDING.md)。

Windows 原生库需要微软 Visual C++ v14 x64 运行库；缺少时由用户从 [微软官方说明](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist) 安装。安装器不会静默安装或代为接受其许可。

## 资源与验证范围

默认单线程棋力引擎、16 MiB 搜索缓存、3 秒分析。轻量引擎 WASM 堆约 156 MiB，增强模式约 431–500 MiB；这是早期本机测量，不包含 Electron、视频缓冲和模型内存。原生模型使用两条 CPU 线程，只在画面稳定变化后运行，不逐帧 OCR。

自动测试覆盖棋规、记谱、合法走棋跟踪、箭头遮罩、采集停滞处理以及实际 NNUE 启用。可用 `--model-self-test` 测模型输出，`--release-self-test` 检查安装包本地协议下的许可、源码、模型和真实引擎。

Mac 既有现场测试覆盖当前 Edge 全屏棋盘的 5 回合、10 步真实走棋及箭头显示；不代表所有皮肤或整局成功率。Windows 运行验证范围见 Release 说明；自动构建与模型测试不能替代 Windows 实机的全屏采集、DPI 和悬浮窗测试。

`desktop:smoke` 的真实截图额外回归需要自行提供有权使用的样本；它们不属于构建必需材料，也不公开分发。日常运行不保存屏幕；显式 `--live-debug` 会将本机画面/日志写入被忽略的 `evaluation/private/`。

## 开源许可

本应用自有代码采用 **GPL-3.0-or-later**，无任何担保。第三方组件保留各自许可及署名：Fairy-Stockfish / ffish 的 GPL、明确 CC0 的 NNUE、MIT 的识别模型与 ONNX Runtime、Apache-2.0 的 OCR、OFL 字体以及 Electron/Chromium/NSIS 的声明。详见 [组件清单](dist/compliance/component-manifest.json) 和应用内“开源许可与源码”。

安装包内及 Release 同时提供 `source.zip`，含应用代码、两份固定 GPL 引擎/棋规完整 C++ 源码归档、构建说明和许可。识别 ONNX 二进制通过固定地址下载并核验。用户截图、第三方游戏皮肤、凭据、开发日志及授权未确认的旧 NNUE 均不公开分发。发布者应保留与每个分发版本匹配的对应源码和许可；组件清单基于上游许可声明，不是上游权属或专利的法律担保。

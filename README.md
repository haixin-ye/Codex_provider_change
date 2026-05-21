

<h1 align="center">Codex Provider History Fixer</h1>

<p align="center">
  一个用于修复 Codex 切换 Provider 后历史会话不可见问题的本地桌面工具。
</p>

<p align="center">
  <img src="docs/images/hero.png" alt="Codex Provider History Fixer" width="780">
</p>

<p align="center">
  <a href="https://github.com/haixin-ye/Codex_provider_change/releases/latest">
    <img alt="Download" src="https://img.shields.io/badge/Download-Latest%20Release-44C7B6?style=for-the-badge">
  </a>
  <a href="https://www.npmjs.com/package/codex-provider-history-fixer">
    <img alt="npm" src="https://img.shields.io/badge/npm-codex--provider--history--fixer-CB3837?style=for-the-badge">
  </a>
  <img alt="Platform" src="https://img.shields.io/badge/Platform-Windows-7C8CFF?style=for-the-badge">
  <img alt="Local First" src="https://img.shields.io/badge/Local--First-No%20Telemetry-35C275?style=for-the-badge">
  <img alt="License" src="https://img.shields.io/badge/License-MIT-E2A95E?style=for-the-badge">
</p>

---

## 目录

- [快速下载](#快速下载)
- [为什么需要这个工具](#为什么需要这个工具)
- [它如何解决问题](#它如何解决问题)
- [界面预览](#界面预览)
- [核心功能](#核心功能)
- [使用说明](#使用说明)
- [实现方式](#实现方式)
- [本地开发](#本地开发)
- [发布说明](#发布说明)
- [安全说明](#安全说明)

## 快速下载

如果你只是想使用这个工具，推荐从 GitHub Releases 下载桌面版，不需要安装 Node.js，也不需要自己构建项目。

### 方式一：GitHub Releases 下载桌面版

适合绝大多数普通用户。

1. 打开 [Releases 下载页面](https://github.com/haixin-ye/Codex_provider_change/releases/latest)
2. 在 `Assets` 区域下载 `.exe` 文件
3. 双击运行应用

Release 页面里通常会出现几类文件：

| 文件 | 适合谁 | 如何使用 |
| --- | --- | --- |
| `Codex Provider History Fixer Setup x.y.z.exe` | 想像普通软件一样安装的用户 | 下载后双击安装，安装完成后从开始菜单或安装目录启动 |
| `Codex Provider History Fixer x.y.z.exe` | 想快速运行的用户 | 下载后直接双击运行，不需要安装 |
| `Source code.zip` / `Source code.tar.gz` | 开发者查看源码 | 不是普通用户要下载的软件 |

> [!TIP]
> 普通用户优先下载 `.exe`。如果你不确定该选哪个，先下载不带 `Setup` 的便携版 `.exe` 试用。

### 方式二：npm 全局安装

适合已经安装 Node.js / npm 的开发者用户。

```bash
npm install -g codex-provider-history-fixer
codex-provider-history-fixer
```

安装后，npm 会创建一个全局命令。你可以在任意目录的 CMD、PowerShell 或终端中运行：

```bash
codex-provider-history-fixer
```

它会打开一个 Electron 桌面应用窗口。npm 方式不会创建桌面快捷方式，也不会像传统安装包那样写入 Windows 注册表。

如果启动时提示 Electron 运行时缺失，可以执行：

```bash
npm install -g electron
codex-provider-history-fixer
```

## 为什么需要这个工具

Codex 的历史会话不是只看本地文件是否存在。它还会检查历史记录中的 Provider 名称是否和当前账号使用的 Provider 对齐。

简单理解就是：

```text
当前 Codex Provider == 历史记录中的 Provider
```

只有二者匹配时，历史会话才会正常显示。

常见场景：

- 你之前使用官方 OpenAI 账号，历史记录中的 Provider 可能是默认的 `openai`
- 后来你切换到自定义 Provider，例如 `ccswitch`
- 本地历史文件仍然存在，但 Codex 当前界面不再显示这些旧会话
- 官方账号的 `config.toml` 往往没有显式 `provider` 字段，而自定义 Provider 又不能简单伪装成 `openai`

所以，单纯修改 `config.toml` 不一定能解决历史记录不可见的问题。这个工具处理的是“历史记录里保存的 Provider 名称”这一侧。

## 它如何解决问题

Codex Provider History Fixer 会在本地扫描 Codex 历史数据，并把你选择的旧 Provider 名称迁移为目标 Provider 名称。

完整流程：

1. 自动定位当前用户的 Codex 数据目录
2. 读取 `config.toml` 中的当前 Provider，作为默认目标 Provider
3. 扫描 `state_5.sqlite` 中记录的 Provider 条目
4. 扫描 `sessions` 文件夹中保存的历史会话 Provider
5. 展示 Provider 分布，让你选择哪些旧名称需要迁移
6. 写入前备份数据库和原始 session 文件
7. 将选中的旧 Provider 名称更新为目标 Provider

整个过程都在你的电脑本地完成，不上传文件，不读取账号密码，不依赖远程服务。

## 界面预览

截图位于 `docs/images/` 目录。你可以替换这些图片来更新 README 展示效果。

```text
docs/images/hero.png
docs/images/app_main.png
docs/images/help.png
```

<p align="center">
  <img src="docs/images/app_main.png" alt="应用主界面" width="880">
</p>

<p align="center">
  <img src="docs/images/help.png" alt="帮助说明弹窗" width="680">
</p>

## 核心功能

| 功能 | 说明 |
| --- | --- |
| 自动定位 Codex 目录 | 默认扫描当前用户目录下的 `.codex` |
| 读取目标 Provider | 默认使用 `config.toml` 中配置的 Provider，也支持手动输入 |
| Provider 分布分析 | 分别展示 `state_5.sqlite` 和 `sessions` 中的 Provider 统计 |
| 自定义迁移范围 | 支持选择 `openai`、`OpenAI`、`codex` 等任意旧 Provider 名称 |
| 完整备份 | 写入前备份 `state_5.sqlite`、wal/shm 文件和整个 `sessions` 文件夹 |
| 可视化进度 | 展示扫描、备份、数据库更新、session 更新等步骤 |
| 本地执行 | 不上传数据，不包含遥测，不需要登录账号 |

## 使用说明

建议在迁移前先关闭 Codex，避免数据库或 session 文件正在被写入。

### 1. 打开应用

你可以通过桌面版 `.exe` 打开，也可以通过 npm 命令打开：

```bash
codex-provider-history-fixer
```

### 2. 确认 Codex 目录

应用会尝试自动定位当前用户的 Codex 目录。一般是：

```text
C:\Users\<你的用户名>\.codex
```

如果没有识别到，可以在界面中手动选择目录。

### 3. 确认目标 Provider

默认情况下，工具会读取：

```text
<codex-home>\config.toml
```

并使用其中的 Provider 作为迁移目标。你也可以手动输入目标 Provider，例如：

```text
ccswitch
```

### 4. 选择要迁移的旧 Provider

工具会展示当前历史记录中出现过的 Provider 名称。你可以只勾选需要迁移的旧名称，例如：

```text
openai
OpenAI
codex
```

未勾选的 Provider 不会被修改。

### 5. 开始迁移

点击迁移后，工具会先创建备份，再执行写入。迁移完成后，重新打开 Codex，检查历史会话是否恢复显示。

## 实现方式

Codex 的本地历史主要分布在两个位置：

```text
<codex-home>/state_5.sqlite
<codex-home>/sessions/**/*.jsonl
```

本工具会分别处理这两类数据。

### `state_5.sqlite`

工具会读取 SQLite 数据库中的线程记录，统计不同 `model_provider` 的数量。迁移时，只更新用户勾选的旧 Provider 名称。

### `sessions/**/*.jsonl`

Session 文件中包含 `session_meta` 记录，其中保存了历史会话的 `model_provider`。工具会遍历所有 `.jsonl` 文件，统计 Provider 分布，并在迁移时更新选中的旧 Provider 名称。

### 写入前备份

迁移前会创建时间戳备份目录：

```text
<codex-home>/backups/provider-migration-YYYYMMDD-HHMMSS
```

备份内容包括：

```text
state_5.sqlite
state_5.sqlite-wal
state_5.sqlite-shm
sessions/
```

如果迁移后发现结果不符合预期，可以使用备份目录中的文件恢复。

## 技术栈

| 模块 | 技术 |
| --- | --- |
| 桌面容器 | Electron |
| 前端框架 | React |
| 语言 | TypeScript |
| 构建工具 | Vite |
| SQLite 处理 | sql.js |
| TOML 解析 | toml |
| UI 图标 | lucide-react |
| 测试 | Vitest |
| 打包 | electron-builder |
| 自动发布 | GitHub Actions |

## 本地开发

安装依赖：

```bash
npm install
```

启动开发版：

```bash
npm run dev:electron
```

运行检查：

```bash
npm run typecheck
npm test
```

构建前端和 Electron 主进程：

```bash
npm run build
```

生成 Windows 安装包和便携版：

```bash
npm run package:win
```

## 发布说明

### 发布到 npm

确认已经登录 npm：

```bash
npm whoami
```

发布：

```bash
npm publish
```

后续更新版本时，先升级版本号：

```bash
npm version patch
npm publish
```

### 发布到 GitHub Releases

项目内置 GitHub Actions 发布流程：

```text
.github/workflows/release.yml
```

创建并推送 `v` 开头的 tag 后，会自动触发 Windows 打包和 Release 上传：

```bash
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0
```

GitHub Actions 会自动完成：

1. 安装依赖
2. 构建项目
3. 打包 Windows 安装版和便携版
4. 创建 GitHub Release
5. 上传 `.exe` 等下载文件

## 安全说明

这个工具会修改本地 Codex 历史记录，因此建议：

- 迁移前关闭 Codex
- 迁移前确认目标 Provider 名称正确
- 迁移完成后重新打开 Codex 检查历史会话
- 确认无误前不要删除备份目录

工具本身不会上传你的本地文件，也不会访问你的账号信息。

## 适用场景

适合：

- 从 OpenAI 官方 Provider 切换到自定义 Provider
- 修改过 `config.toml` 中的 Provider 名称
- 本地历史文件仍然存在，但 Codex 界面不显示旧会话
- 想批量统一历史记录中的 Provider 名称

不适合：

- 本地历史文件已经被删除
- Codex 目录不存在
- 需要恢复远端账号数据
- 需要恢复被手动删除的会话内容

## Roadmap

- Windows 安装包和便携版发布
- macOS / Linux 打包支持
- 备份恢复按钮
- 更详细的迁移日志导出
- 自动检测 Provider 不一致风险

## License

MIT

<p align="center">
  <img src="docs/images/hero.png" alt="Codex Provider History Fixer" width="780">
</p>

<h1 align="center">Codex Provider History Fixer</h1>

<p align="center">
  一个用于修复 Codex 切换 Provider 后历史会话不可见问题的本地桌面工具。
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
- [最新版本](#最新版本)
- [为什么需要这个工具](#为什么需要这个工具)
- [它如何解决问题](#它如何解决问题)
- [界面预览](#界面预览)
- [界面区域说明](#界面区域说明)
- [核心功能](#核心功能)
- [使用说明](#使用说明)
- [实现方式](#实现方式)
- [安全说明](#安全说明)

## 快速下载

如果你只是想使用这个工具，推荐从 GitHub Releases 下载桌面版，不需要安装 Node.js，也不需要自己构建项目。

当前最新版本：[`v0.2.0`](https://github.com/haixin-ye/Codex_provider_change/releases/tag/v0.2.0)

### 方式一：GitHub Releases 下载桌面版

适合绝大多数普通用户。

1. 打开 [v0.2.0 下载页面](https://github.com/haixin-ye/Codex_provider_change/releases/tag/v0.2.0)
2. 在 `Assets` 区域下载 `Codex.Provider.History.Fixer.Setup.0.2.0.exe` 或 `Codex.Provider.History.Fixer.0.2.0.exe`
3. 双击运行应用

Release 页面里通常会出现几类文件：

| 文件 | 适合谁 | 如何使用 |
| --- | --- | --- |
| `Codex.Provider.History.Fixer.Setup.x.y.z.exe` | 想像普通软件一样安装的用户 | 下载后双击安装，安装完成后从开始菜单或安装目录启动 |
| `Codex.Provider.History.Fixer.x.y.z.exe` | 想快速运行的用户 | 下载后直接双击运行，不需要安装 |
| `Source code.zip` / `Source code.tar.gz` | 开发者查看源码 | 不是普通用户要下载的软件 |

> [!TIP]
> 普通用户优先下载带 `Setup` 的安装版。如果你只是想临时试用，可以下载不带 `Setup` 的便携版。

## 最新版本

### v0.2.0

- 迁移前会检测 Codex CLI 和 Codex App 进程，未关闭时会阻止继续写入。
- 检测到 Codex 正在运行时，弹窗支持重新检测，也支持在二次确认后一键关闭全部 Codex 进程。
- 迁移任务改为在后台 worker 中执行，避免界面在备份和写入时卡死或无响应。
- `state_5.sqlite` 写入改为使用原生 SQLite 事务更新，不再用 `sql.js` 导出整库后覆盖文件。
- 打包流程修复了 `better-sqlite3` 的 Electron ABI、worker 解包和运行时依赖问题。

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

<p align="center">
  <img src="docs/images/app_main.png" alt="应用主界面" width="880">
</p>

<p align="center">
  <img src="docs/images/help.png" alt="帮助说明弹窗" width="680">
</p>

## 界面区域说明

应用启动后会自动扫描本机 Codex 数据目录。主界面主要分为 5 个部分：

| 区域 | 作用 | 你需要关注什么 |
| --- | --- | --- |
| 顶部标题栏 | 显示工具名称、当前版本、本机模式和帮助按钮 | 点击问号按钮可以查看迁移原因说明 |
| 左侧 Provider 设置 | 设置 Codex 目录、目标 Provider、选择要迁移的旧 Provider 名称 | 这是最重要的操作区，迁移前主要检查这里 |
| 顶部统计卡片 | 显示线程记录数量、Session 文件数量、预计待更新数量 | 用来判断工具是否扫描到了你的历史数据 |
| 中间 Provider 分布 | 分别展示数据库和 session 文件中的 Provider 名称分布 | 用来判断哪些旧名称需要迁移到当前名称 |
| 底部迁移审计 | 显示扫描、备份、数据库更新、Session 更新的执行进度 | 用来确认迁移是否完成，以及备份目录在哪里 |

### 左侧 Provider 设置

这一块决定“从哪里读取历史记录”和“要迁移到哪个服务商名称”。

- **Codex 目录**：通常是 `C:\Users\<你的用户名>\.codex`。如果自动识别失败，可以点击文件夹按钮手动选择。
- **目标 Provider**：迁移后的目标名称。默认会读取 `config.toml` 中当前正在使用的 Provider。
- **要迁移的源名称**：扫描到的旧 Provider 名称列表。勾选的名称会被迁移，未勾选的会保持原样。
- **备份并迁移**：开始执行迁移。点击后会先备份，再写入修改。
- **重新扫描**：重新读取 Codex 目录中的数据库和 session 文件。

### 顶部统计卡片

统计卡片用于快速判断数据是否正常：

- **线程记录**：来自 `state_5.sqlite`，代表 Codex 数据库中的历史线程记录数量。
- **Session 文件**：来自 `sessions` 文件夹，代表本地保存的历史会话文件数量。
- **待更新**：根据你勾选的旧 Provider 名称计算出的预计更新数量。

如果这里显示为 0，通常说明没有识别到对应数据，或者选择的 Codex 目录不正确。

### Provider 分布区域

中间两块图表分别代表两类历史数据：

- **`state_5.sqlite` 中记录的 Provider 条目**：数据库里的历史线程 Provider 分布。
- **`sessions` 文件夹中保存的历史会话 Provider**：原始 session 文件中的 Provider 分布。

每个小块代表一个 Provider 名称，例如 `openai`、`ccswitch`、`codex`。

你勾选左侧源名称后，这里会同步显示“将被迁移”的数量和占比，方便确认迁移范围。

### 迁移审计区域

底部区域展示执行过程：

1. **扫描配置**：读取 Codex 目录、数据库和 session 文件。
2. **完整备份**：备份 `state_5.sqlite`、wal/shm 文件和整个 `sessions` 文件夹。
3. **更新数据库**：修改 `state_5.sqlite` 中选中的旧 Provider 名称。
4. **更新 Session Metadata**：修改 `sessions/**/*.jsonl` 中选中的旧 Provider 名称。

迁移完成后，这里会显示更新结果，并提供备份目录入口。

## 核心功能

| 功能 | 说明 |
| --- | --- |
| 自动定位 Codex 目录 | 默认扫描当前用户目录下的 `.codex` |
| 读取目标 Provider | 默认使用 `config.toml` 中配置的 Provider，也支持手动输入 |
| Provider 分布分析 | 分别展示 `state_5.sqlite` 和 `sessions` 中的 Provider 统计 |
| 自定义迁移范围 | 支持选择 `openai`、`OpenAI`、`codex` 等任意旧 Provider 名称 |
| 完整备份 | 写入前备份 `state_5.sqlite`、wal/shm 文件和整个 `sessions` 文件夹 |
| Codex 进程保护 | 迁移前要求关闭 Codex CLI 和 Codex App，避免和正在写入的数据库或 session 文件冲突 |
| 一键关闭 Codex | 检测到 Codex 正在运行时，可在二次确认后一键结束全部 Codex 进程 |
| 后台迁移 | 备份和写入在 worker 中执行，减少界面卡顿和无响应 |
| 可视化进度 | 展示扫描、备份、数据库更新、session 更新等步骤 |
| 本地执行 | 不上传数据，不包含遥测，不需要登录账号 |

## 使用说明

建议在迁移前先关闭 Codex，避免数据库或 session 文件正在被写入。整个操作可以按下面顺序完成。

如果点击迁移时检测到 Codex 仍在运行，工具会弹窗阻止继续操作。你可以手动关闭 Codex 后点击“我已关闭 Codex 应用（CLI 和 Codex APP）”重新检测，也可以点击“一键关闭全部 Codex”并在风险提示中确认。强制关闭只会结束 Codex 进程，不会删除本地历史文件，但可能中断正在运行的 Codex 任务。

### 第 1 步：打开应用

你可以通过桌面版 `.exe` 打开，也可以通过 npm 命令打开：

```bash
codex-provider-history-fixer
```

打开后，应用会自动尝试扫描当前用户的 Codex 目录。

### 第 2 步：确认 Codex 目录

应用会尝试自动定位当前用户的 Codex 目录。一般是：

```text
C:\Users\<你的用户名>\.codex
```

如果没有识别到，或者统计卡片显示数据明显不对，可以点击左侧 **Codex 目录** 右侧的文件夹按钮，手动选择 `.codex` 目录。

### 第 3 步：确认目标 Provider

默认情况下，工具会读取：

```text
<codex-home>\config.toml
```

并使用其中的 Provider 作为迁移目标。你也可以手动输入目标 Provider，例如：

```text
ccswitch
```

这个字段的意思是：旧历史记录最终要被改成哪个 Provider 名称。

如果你现在 Codex 使用的是 `ccswitch`，这里通常就应该是：

```text
ccswitch
```

### 第 4 步：选择要迁移的旧 Provider

工具会展示当前历史记录中出现过的 Provider 名称。你可以只勾选需要迁移的旧名称，例如：

```text
openai
OpenAI
codex
```

勾选规则：

- 勾选旧名称：这些历史记录会被改成目标 Provider
- 不勾选旧名称：这些历史记录保持不变
- 目标 Provider 本身不会被迁移，因为它已经是当前目标

示例：

| 当前目标 Provider | 扫描到的旧名称 | 建议 |
| --- | --- | --- |
| `ccswitch` | `openai` | 如果这是你以前官方账号留下的历史记录，可以勾选 |
| `ccswitch` | `OpenAI` | 如果你希望一起恢复，也可以勾选 |
| `ccswitch` | `ccswitch` | 不需要勾选，它已经是目标名称 |

### 第 5 步：检查待更新数量

勾选旧 Provider 后，右侧会更新：

- **待更新** 数量
- 数据库中的将迁移数量
- session 文件中的将迁移数量
- 底部总进度条的预计状态

如果数量明显不对，先不要点击迁移，重新检查 Codex 目录和勾选项。

### 第 6 步：点击“备份并迁移”

点击后工具会按顺序执行：

1. 扫描当前配置
2. 创建完整备份
3. 更新 `state_5.sqlite`
4. 更新 `sessions` 文件夹中的历史会话元数据

迁移过程中不要关闭应用。

### 第 7 步：重新打开 Codex 检查结果

迁移完成后，重新打开 Codex，检查历史会话是否恢复显示。

如果结果不符合预期，可以到迁移审计区域显示的备份目录中找到原始备份文件。

## 实现方式

Codex 的本地历史主要分布在两个位置：

```text
<codex-home>/state_5.sqlite
<codex-home>/sessions/**/*.jsonl
```

本工具会分别处理这两类数据。

### `state_5.sqlite`

工具会读取 SQLite 数据库中的线程记录，统计不同 `model_provider` 的数量。迁移时，只更新用户勾选的旧 Provider 名称。

写入数据库时使用原生 SQLite 连接和事务更新 `threads.model_provider`，不会导出整个数据库文件再覆盖原文件。这样可以降低 WAL/SHM 并发状态下覆盖数据库导致损坏的风险。

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
| SQLite 处理 | better-sqlite3 |
| TOML 解析 | toml |
| UI 图标 | lucide-react |
| 测试 | Vitest |
| 打包 | electron-builder |
| 自动发布 | GitHub Actions |



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

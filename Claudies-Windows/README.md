# Claudies for Windows（中文说明）

在同一台 Windows 电脑上**并排运行多个 Claude 账号**(Claude Desktop / Claude Code),
彼此完全隔离;并且可以**共享会话(Sessions)文件夹**,这样你**切换账号后还能在同一个
上下文里继续工作**。

本工具是 macOS 工具 [*Claudies*](https://github.com/democra-ai/claudies) 思路的
Windows 版。100% 本地运行,无云端依赖,**不需要管理员权限**。

> 非官方社区工具。仅使用公开的 Electron 参数 `--user-data-dir` 和环境变量
> `CLAUDE_CONFIG_DIR`,与 Anthropic 官方无关联。MIT 许可证。

---

## ⚠️ 重要:你需要"Electron .exe 版"的 Claude Desktop

Windows 上的 Claude Desktop 有两种安装形态:

| 形态 | 安装位置 | 是否支持本工具 |
|---|---|---|
| **Electron .exe 版**(官网 `Claude Setup.exe`) | `%LOCALAPPDATA%\AnthropicClaude` | ✅ 支持,可同时并排开多个隔离账号 |
| **微软商店 / MSIX 打包版** | `%LOCALAPPDATA%\Packages\Claude_xxx\` | ❌ 通过打包应用 ID 启动,不接受 `--user-data-dir`,无法隔离启动 |

**经检测,你当前装的是 MSIX 商店版**,数据在
`...\AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\`。
要让本工具完整生效,请按下面"安装官方 .exe 版"一节操作。

### 安装官方 .exe 版

1. 打开官网下载页:**https://claude.ai/download**
2. 点击 **Windows**,下载 `Claude Setup.exe`。
3. 双击运行;若出现 Windows SmartScreen 提示,确认发布者为 Anthropic 后继续。
4. 安装完成后从开始菜单启动一次,登录你的主账号。
5. 回到本工具运行 `claudies detect`,应能看到
   `%LOCALAPPDATA%\AnthropicClaude\app-xxx\claude.exe`。

> 两种版本可以共存。装了 .exe 版后,本工具会自动优先使用它。

---

## 它是怎么做到的

- **Claude Desktop** 是 Electron 应用,支持 `--user-data-dir=<路径>` 参数,可以把
  它的全部状态(登录、对话、会话 Sessions、MCP 配置、技能 Skills、偏好设置)放到你
  指定的文件夹。不同文件夹 = 互相独立的账号实例。
- **Claude Code** 支持 `CLAUDE_CONFIG_DIR` 环境变量,给每个 profile 一个独立的配置
  目录,即可隔离登录。
- **共享**使用 Windows **目录联接(junction,`mklink /J`)**。联接**不需要管理员
  权限**(普通 Windows 符号链接才需要)。MCP 配置、偏好是 JSON 文件,改用"按需复制"。

所有数据都放在 `%LOCALAPPDATA%\Claudies` 下。除非你显式使用 `add -FromDefault`
(它只**复制**、绝不移动),否则**不会改动**你现有的 Claude 安装。

## 文件清单

| 文件 | 说明 |
|---|---|
| `claudies.ps1` | 核心引擎 + 命令行 |
| `claudies-gui.ps1` | 简易图形界面(WinForms) |
| `Claudies.bat` | 双击→打开界面;带参数→执行命令行 |
| `install.ps1` | 可选:把本目录加入 PATH + 创建开始菜单快捷方式 |
| `README.md` | 本文件 |

## 快速上手(图形界面)

1. 双击 **`Claudies.bat`**。
2. 点 **New profile…**,命名为 `work`;再建一个 `personal`。
3. 分别选中,点 **Toggle Sessions share**,让两个都显示 `SHARED`。
4. 选 `work` → **Launch Desktop**,用 A 账号登录开始工作。
5. 额度用完?选 `personal` → **Launch Desktop**,用 B 账号登录——同一会话上下文还在,
   继续干活。

## 快速上手(命令行)

```powershell
# 在本目录里(或运行 install.ps1 后可在任意位置):
.\claudies.ps1 add work
.\claudies.ps1 add personal
.\claudies.ps1 share work sessions
.\claudies.ps1 share personal sessions
.\claudies.ps1 launch work
# ……稍后切换账号:
.\claudies.ps1 launch personal
```

如果 PowerShell 拦截脚本,这样运行一次即可:

```powershell
powershell -ExecutionPolicy Bypass -File .\claudies.ps1 help
```

或者安装以便随处调用(加入用户 PATH + 开始菜单):

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
# 然后打开一个新的终端窗口:
claudies help
```

## 命令一览

```
claudies add <名字> [-FromDefault]    创建 profile(-FromDefault 复制当前默认数据)
claudies list                         列出所有 profile 及其共享情况
claudies launch <名字>                以该 profile 启动 Claude Desktop(隔离)
claudies code <名字> [-Start]         为该 profile 准备/启动 Claude Code
claudies share <名字> [项目...]       在 profile 间共享(默认:sessions)
claudies unshare <名字> [项目...]     取消共享;保留一份私有副本
claudies shortcut <名字>              为该 profile 创建桌面快捷方式
claudies status                       健康检查(检测 + 每个 profile)
claudies detect                       显示检测到的 claude.exe 路径
claudies remove <名字> [-Purge]       删除 profile(-Purge 同时删数据)
```

可共享的项目:`sessions`(工作上下文)、`mcp`、`preferences`。

## 每个账号单独用 Claude Code

```powershell
claudies code work          # 显示 CLAUDE_CONFIG_DIR,并生成 claude-work 启动器
claude-work                 # 以 work 账号运行 Claude Code
```

## 注意事项与限制

- **登录跳转:** 新 profile **首次登录前**请先退出其他 Claude 窗口,这样
  `claude://` 登录链接才会跳到正确的窗口。
- **云端同步的对话**归属于当前登录账号;可靠可共享的"上下文"是本地的
  **agent / Cowork 会话**文件夹(`local-agent-mode-sessions`),也正是
  `share ... sessions` 所联接的目标。
- **找不到 Claude.exe?** 多半是只装了 MSIX 版。请按上文装 .exe 版;或手动指定:
  在 PowerShell 里设置环境变量 `CLAUDIES_CLAUDE_EXE` 指向你的 claude.exe,再运行
  `claudies detect`。
- **卸载本工具:** `powershell -ExecutionPolicy Bypass -File .\install.ps1 -Uninstall`
  (你的 profile 数据会保留)。

## 许可证

MIT。概念来源:macOS 版 *Claudies* 与上游 *claude-multiprofile*。

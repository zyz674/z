# 霓虹突围（Neon Breakout）

一款使用 **Vite + TypeScript + Phaser 3** 开发的 2D 俯视角霓虹生存射击小游戏。
玩家在深色霓虹风格地图中自动战斗、吸收经验并不断升级，对抗越来越强的敌人波次。

## 已实现功能（MVP）

- 开始界面：游戏名称、开始按钮、操作说明、历史最高分、音效开关
- 玩家系统：生命值、移动速度、攻击伤害、攻击速度、子弹速度、攻击范围、经验、等级
- 受伤反馈：扣血、无敌时间、闪烁、红色受伤渐晕
- 自动攻击：索敌攻击范围内最近敌人、按射速发射、命中/穿透、地图外自动销毁
- 三种敌人：普通敌人、快速敌人、重型敌人（生命/速度/体型不同）
- 敌人追踪玩家、接触造成伤害，死亡获得分数并概率掉落经验晶体
- 经验晶体自动吸附与拾取，升级后暂停并展示 3 个互不重复的强化
- 10 种数据驱动强化：伤害、射速、移速、最大生命、弹速、多重射击、吸取范围、攻击范围、穿透、回血
- 难度系统：生成间隔、敌人生命、敌人速度随时间提升，快速/重型敌人逐渐解锁
- HUD：生命条、经验条、等级、生存时间、分数、击杀数、暂停按钮、音效开关
- 暂停/继续/重新开始（ESC 或按钮）
- 结算页面：生存时间、击杀数、最高等级、最终分数、历史最高分、重新开始
- 程序化音效（Web Audio API，可静音，加载失败不影响运行）
- 粒子特效：射击、命中、死亡、升级、受伤、经验拾取
- 章节制 + 关底 Boss：13:00 前奏、13:30 倒计时、14:00 生成固定 Boss、15:00 超时失败
- Ch1 Boss「裂隙主宰·奈落」：追踪、接触高伤、带预警冲刺、独立血条
- 章节选择与解锁：Ch1 默认解锁，通关 Ch1 解锁 Ch2（Ch2/Ch3 本轮占位提示）
- 版本化存档：`neonBreakoutSaveV2`，按章节最高分/评级，自动迁移旧版最高分
- 开发环境调试接口 `window.__NEON_DEBUG__`（生产环境不挂载）
- 桌面 16:9 适配 + 基础响应式

## 操作方式

| 按键 | 功能 |
| --- | --- |
| WASD / 方向键 | 移动 |
| ESC | 暂停 / 继续 |
| 鼠标 | 点击按钮、选择升级 |

角色会自动攻击攻击范围内最近的敌人，无需手动瞄准。

## 安装方法

需要 Node.js 18+（推荐 20+）。

```bash
npm install
```

## 启动命令

```bash
npm run dev
```

然后打开终端显示的地址（默认 http://localhost:5173）。

## 测试命令

```bash
npm test
```

运行 ChapterManager 时间线 / 存档 / 评级单元测试（tsx + node:test）。

## 构建命令

```bash
npm run build
```

构建产物输出到 `dist/`，可再用：

```bash
npm run preview
```

本地预览生产构建。

## 分享给朋友试玩

### 方式一：GitHub Pages（推荐）

1. 在 GitHub 新建仓库（公开仓库免费）。
2. 把整个项目推送上去（`node_modules` 已被 `.gitignore` 排除，不需要上传）。
3. 仓库已包含自动部署工作流：`.github/workflows/deploy.yml`，推送到 `main` 分支后会自动执行 `npm ci && npm run build` 并发布到 GitHub Pages。
4. 在仓库 Settings → Pages 中确认 Source 为 **GitHub Actions**。
5. 部署完成后，把生成的 `https://你的用户名.github.io/仓库名/` 链接发给朋友即可玩。

> 注意：免费版 GitHub Pages 要求仓库是公开的；朋友无需 GitHub 账号即可访问。

### 方式二：局域网/临时链接（不需要 GitHub）

在同一 WiFi 下：

```bash
npm run build
npm run preview -- --host
```

把终端显示的 `http://你的电脑IP:4173` 发给朋友即可。

想给不在同一网络的微信好友玩，可用临时代理：

```bash
npm run build
npx serve dist -l 5173
npx ngrok http 5173
```

`ngrok` 会生成一个临时公网链接，分享这个链接即可。

## 项目结构

```
├── index.html                  # DOM 界面骨架（HUD/菜单/升级/结算）
├── package.json
├── tsconfig.json               # TypeScript 严格模式
├── vite.config.ts
├── TODO.md                     # 开发任务清单
└── src/
    ├── main.ts                 # 入口：初始化 UIManager 与 Phaser.Game
    ├── styles/
    │   └── style.css           # 霓虹 UI 样式
    └── game/
        ├── types.ts            # 共享类型（PlayerStats、HUDData、UpgradeId 等）
        ├── config/
        │   ├── GameConfig.ts   # Phaser 场景、分辨率、缩放配置
        │   └── BalanceConfig.ts# 玩家/敌人/难度/经验曲线集中数值配置
        ├── data/
        │   └── ChapterConfig.ts # 章节时间线/Boss/难度/评级集中配置
        ├── types/
        │   └── Chapter.ts       # 章节/Boss/存档/调试接口类型
        ├── scenes/
        │   ├── BootScene.ts    # 程序化生成纹理
        │   ├── MenuScene.ts    # 霓虹背景 + 开始界面
        │   └── GameScene.ts    # 核心玩法逻辑
        ├── entities/
        │   ├── Player.ts       # 玩家移动/受伤/无敌
        │   ├── Enemy.ts        # 敌人追踪与生命（含精英变体）
        │   ├── Bullet.ts       # 子弹生命周期
        │   ├── ExperienceGem.ts# 经验晶体
        │   └── Boss.ts         # Ch1 关底 Boss
        ├── systems/
        │   ├── AudioManager.ts # Web Audio 程序化音效
        │   ├── TouchControls.ts# 移动输入抽象（虚拟摇杆预留）
        │   ├── ChapterManager.ts # 章节时间线/阶段/事件/评级
        │   └── Upgrades.ts     # 数据驱动强化定义与抽取
        ├── storage/
        │   └── SaveData.ts     # 版本化存档与旧存档迁移
        ├── ui/
        │   └── UIManager.ts    # DOM 界面与最高分存储
        └── utils/
            └── TextureFactory.ts # Graphics 生成纹理
```

## 调试接口（仅开发环境）

在 `npm run dev` 下，浏览器控制台可直接使用：

```js
window.__NEON_DEBUG__.getSnapshot() // 章节/阶段/Boss/存档快照
window.__NEON_DEBUG__.setElapsedMs(840000) // 直接跳到 14:00
window.__NEON_DEBUG__.defeatBoss()
window.__NEON_DEBUG__.killPlayer()
```

生产构建中 `window.__NEON_DEBUG__` 不存在。

## 后续可扩展功能

1. 实现 Ch2 / Ch3 完整章节内容与专属敌人/美术
2. 移动端虚拟摇杆与触屏适配
3. 多阶段 Boss / 弹幕攻击 / 随机 Boss 池（当前刻意未做）
4. 成就 / 图鉴 / 解锁系统
5. 无尽模式分支、每日挑战与更多地图主题

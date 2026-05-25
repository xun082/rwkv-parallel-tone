# RWKV Parallel Tone Converter

![20260427162927](https://raw.githubusercontent.com/xun082/md/main/blogs.images20260427162927.png)

Next.js 项目，实现并行语气转换。输入一段文本，AI 将同时生成多种不同风格和语气的表达方式，包括职场、生活、方言、文学、网络等 80+ 种风格。

## 功能特性

- 并行生成：一次性生成多种语气转换
- 80+ 种风格：职场、生活、方言、文学、网络等
- 自定义 Prompt：支持编辑和保存每个风格的模板
- 配置持久化：自定义配置保存在浏览器本地存储

## 开发

```bash
pnpm install
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000)

## 构建

```bash
pnpm build
pnpm start
```

## API 配置

在根目录创建 `.env.local`（可参考 `.env.example`）：

```bash
RWKV_API_URL=http://your-host:1800/big_batch/completions
RWKV_PASSWORD=your_password
```

请求经 Next.js 服务端路由 `/api/generate` 转发到上游 RWKV 服务。

## 项目结构

```
src/
├── app/
│   ├── page.tsx           # 主页面
│   ├── api/generate/      # 生成 API 代理
│   └── globals.css
└── lib/
    ├── style-configs.ts   # 风格与 prompt 配置
    ├── prompt-rules.ts    # 严格输出规则
    └── prompt-store.ts    # 本地自定义 prompt 存储
```

## 相关项目

后端：[RWKV Lightning](https://github.com/RWKV-Vibe/rwkv_lightning)

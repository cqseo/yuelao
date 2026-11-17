# 月下 · 灯火巷 V2 — 建筑与材质试验

这是独立的 3D 可漫游美术样机，不是正式站。它与 yuexia.app 主站的 3D 引擎、求签功能、支付、账号和路由均无集成，不可将这个目录直接合并作为正式 3D 世界。

## 与 V1 的差别
- 废弃 V1 中的西式开源摊位与低多边形模型，改用中国古建筑屋檐、牌坊、格扇和柱梁结构。
- 建筑结构使用 hafewa/chinese-ancient-architecture-sandbox (2026, MIT) 的 BuildingGenerator.js；保留 MIT 版权声明。
- 纹理为 Poly Haven CC0 官方 API 下载的 1K 石板、青瓦、木材，包括 diffuse、OpenGL normal、roughness 共 9 文件，记录来源 URL 与 MD5。
- WebGL / Three.js 夜空、月亮、薄雾、暖灯、细微光粒、步行探索；手机默认开启流畅模式。
- 页面为 noindex,nofollow 且 robots.txt 禁抓取。

## 重现构建
在 sites/yuelao 目录：
1. python3 prototypes/lantern-lane-v2/download_textures.py
2. pnpm exec vite build prototypes/lantern-lane-v2 --base ./ --outDir /tmp/yuexia-lantern-lane-v2-dist --emptyOutDir
3. 仅以独立 Cloudflare Pages 项目 yuexia-lantern-lane-v2 发布构建目录。不部署主站 Worker，也不合并 main。

## 来源与许可
- MIT 建筑生成器：https://github.com/hafewa/chinese-ancient-architecture-sandbox (Copyright © 2026 zhulin025)，MIT 文件见 LICENSE.upstream.txt。
- CC0 纹理：Poly Haven
  - https://polyhaven.com/a/grey_roof_tiles
  - https://polyhaven.com/a/grey_stone_path
  - https://polyhaven.com/a/wood_floor_worn
  - https://polyhaven.com/license
- 本版本测试建筑结构与 PBR 材质组合，尚未达到电影级真实效果，也不代表整套模型是当年最新作品。
- 二进制纹理不提交 GitHub，运行可追溯下载脚本取得。

## 尚未完成
建筑细节真实比例、雕花磨损、人物、碰撞系统、景深和反射仍需打磨；手机端真实设备性能须另验收；正式整合需用户再次明确授权。

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


## V2.1 美术细节与性能优化（2026-11-17）
- 新增 6 处商铺木格窗、朱红门板、檐下构件、手写牌匾、纸灯和暖色窗光；主殿新增格窗与绸幡。
- 场景新增 4 棵实例化花树、湿石板反光小斑块与远景薄雾。无用户账户、支付或求签数据介入。
- 技术优化：初次尝试高密度独立几何体的实现因浏览器渲染超时被撤回；现采用程序 Canvas 窗格纹理及 InstancedMesh 花树，显著减少 draw call。
- 调低天空环境光与 ACES 曝光，在保持灯笼亮度的同时避免过曝。手机仍默认低画质；可使用 ?noDetail=1 进行基线对比。
- 实测 Cloudflare 浏览器：桌面预览正常加载；390px 移动端 WebGL 启动、纹理 9/9、四处导览与画质切换正常，无 JS/page 请求错误，无横向溢出。
- 注意：自动化浏览器的 WebGL 帧率不等同于实际手机 GPU 的帧率，正式合入前仍须在真实 iOS/Android 设备测试 FPS、GPU 发热与首次加载速度。
- 本阶段仅供视觉审查和迭代，不代表已经达到 InPeace 等商业标杆的最终美术水准。PR 保持 Draft，站点 main 不得修改。

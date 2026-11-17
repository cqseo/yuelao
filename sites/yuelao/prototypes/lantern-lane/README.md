# 月下 · 灯火巷 | 独立 3D 预览

这是独立的 Three.js / Vite 静态演示页面，不是正式站功能。构建结果只部署到与 yuexia.app 分离的 Cloudflare Pages 预览项目。不会修改现有的 3D 集市、登录、求签、支付或生产 Worker。

## 功能
- 月夜场景、可步行石板街、暖色灯光、建筑、竹影和祈愿坛。
- 16 组真实 GLB（Polygonal Mind 的 Lunar Year / Medieval Fair 及 Kenney Nature Kit）。
- 电脑使用 WASD、鼠标拖动转向、方向键；手机使用左侧摇杆移动、右侧滑动转向；顶部按钮可以前往四个地标。
- 省电模式用于降低像素比并关掉粒子；移动端默认开启。
- noindex / nofollow，且不会写入主站 sitemap。
- 西式集市元素只是布局原型，正式版本需要改成符合月下统一美术风格的中式材质和比例。

## 构建（从 sites/yuelao 目录）
1. python3 prototypes/lantern-lane/download_models.py
2. pnpm exec vite build prototypes/lantern-lane --base ./ --outDir /tmp/yuexia-lantern-lane-dist --emptyOutDir
3. pnpm exec vite preview --outDir /tmp/yuexia-lantern-lane-dist --host 127.0.0.1 --port 4197

仅将该构建目录上传到独立 Cloudflare Pages 项目，不使用 wrangler deploy 部署正式 Worker。

GLB 源文件从已锁定的 GitHub commit SHA 下载。 model-sources.json 中记录了下载 URL、原始位置、预期文件大小和 CC0 许可。models-lock.json 记录下载后 SHA256，外部 GLB 二进制文件被 .gitignore 排除，不占用主仓库。

授权来源：
- https://github.com/ToxSam/cc0-models-Polygonal-Mind
- https://github.com/Hidencod/tge-assets

## 未来正式集成
此项目只是验证画质、操作、模型体积及空间布局；暂未实现完整碰撞、NPC 对话及主站传送。待站长评估后，另行把选中的模型与场景转换为主站 src/market/engine 中按需加载的场景模块。未取得明确确认前不得合并到 main。

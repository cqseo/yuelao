/**
 * BuildingGenerator.js
 * 宋代古典建筑程序化生成器（参考《营造法式》与《清明上河图》）
 * 支持实时参数化调整：长宽跨度、墙体层高、飞檐翘角弧度、屋顶形式（歇山顶、悬山顶、攒尖亭、水榭）
 */
import * as THREE from 'three';

export class BuildingGenerator {
    constructor() {
        this.materials = this.initMaterials();
    }

    initMaterials() {
        // 1. 宋代青灰筒瓦纹理（Canvas 程序化绘制逼真垄瓦）
        const tileCanvas = document.createElement('canvas');
        tileCanvas.width = 512;
        tileCanvas.height = 512;
        const tctx = tileCanvas.getContext('2d');
        tctx.fillStyle = '#3a3f44'; // 黛瓦基底色
        tctx.fillRect(0, 0, 512, 512);

        // 纵向瓦垄与阴阳瓦明暗
        const numRows = 24;
        const rowWidth = 512 / numRows;
        for (let i = 0; i < numRows; i++) {
            const x = i * rowWidth;
            // 瓦垄脊（圆筒瓦高光）
            const grad = tctx.createLinearGradient(x, 0, x + rowWidth, 0);
            grad.addColorStop(0, '#2b2f33');
            grad.addColorStop(0.3, '#575f66');
            grad.addColorStop(0.7, '#3e444a');
            grad.addColorStop(1, '#25282b');
            tctx.fillStyle = grad;
            tctx.fillRect(x, 0, rowWidth, 512);

            // 瓦沟阴影
            tctx.fillStyle = 'rgba(15,18,20,0.6)';
            tctx.fillRect(x, 0, 2, 512);
        }

        const tileTexture = new THREE.CanvasTexture(tileCanvas);
        tileTexture.wrapS = THREE.RepeatWrapping;
        tileTexture.wrapT = THREE.RepeatWrapping;

        // 2. 朱红柱梁与木构（宋代温润朱砂/栗壳木）
        const woodMat = new THREE.MeshStandardMaterial({
            color: 0x8a382c, // 朱砂红
            roughness: 0.65,
            metalness: 0.08
        });

        // 3. 栗壳木（深木色：枋、桁檩、格扇框）
        const darkWoodMat = new THREE.MeshStandardMaterial({
            color: 0x4d3227,
            roughness: 0.72,
            metalness: 0.05
        });

        // 4. 青石台基（阶条石、须弥座）
        const stoneMat = new THREE.MeshStandardMaterial({
            color: 0x939a95,
            roughness: 0.88,
            metalness: 0.05
        });

        // 5. 粉墙（宋代泥灰刷白墙面）
        const wallMat = new THREE.MeshStandardMaterial({
            color: 0xe8e6dc, // 米白暖调
            roughness: 0.92,
            metalness: 0.02
        });

        // 6. 雕花木格扇窗（半透古窗纸质感）
        const latticeCanvas = document.createElement('canvas');
        latticeCanvas.width = 256;
        latticeCanvas.height = 256;
        const lctx = latticeCanvas.getContext('2d');
        lctx.fillStyle = '#eedec5'; // 暖黄窗纸
        lctx.fillRect(0, 0, 256, 256);
        lctx.strokeStyle = '#5a3523'; // 木条
        lctx.lineWidth = 10;
        // 冰裂纹/万字格
        lctx.strokeRect(5, 5, 246, 246);
        for (let i = 1; i <= 3; i++) {
            lctx.beginPath();
            lctx.moveTo(i * 64, 0); lctx.lineTo(i * 64, 256);
            lctx.stroke();
            lctx.beginPath();
            lctx.moveTo(0, i * 64); lctx.lineTo(256, i * 64);
            lctx.stroke();
        }
        const latticeTexture = new THREE.CanvasTexture(latticeCanvas);
        latticeTexture.wrapS = THREE.RepeatWrapping;
        latticeTexture.wrapT = THREE.RepeatWrapping;

        const latticeMat = new THREE.MeshStandardMaterial({
            map: latticeTexture,
            roughness: 0.7,
            metalness: 0.05
        });

        // 7. 屋顶瓦片材质
        const roofMat = new THREE.MeshStandardMaterial({
            map: tileTexture,
            color: 0x5a6369,
            roughness: 0.78,
            metalness: 0.12
        });

        // 8. 金色/铜质瓦当与脊兽
        const goldMat = new THREE.MeshStandardMaterial({
            color: 0xc8963e,
            roughness: 0.35,
            metalness: 0.65
        });

        return {
            wood: woodMat,
            darkWood: darkWoodMat,
            stone: stoneMat,
            wall: wallMat,
            lattice: latticeMat,
            roof: roofMat,
            gold: goldMat
        };
    }

    /**
     * 创建建筑实例
     * @param {Object} options 建筑参数配置
     */
    createBuilding(options = {}) {
        const config = {
            id: 'bldg_' + Math.random().toString(36).substr(2, 9),
            type: options.type || 'xieshan', // xieshan (歇山殿), xuanshan (悬山阁), pavilion (攒尖亭), terrace (水榭)
            position: options.position ? options.position.clone() : new THREE.Vector3(0, 0, 0),
            rotationY: options.rotationY || 0,
            width: options.width || (options.type === 'pavilion' ? 4.5 : 8.0),
            depth: options.depth || (options.type === 'pavilion' ? 4.5 : 6.0),
            wallHeight: options.wallHeight || 3.8,
            roofHeight: options.roofHeight || 2.4,
            eavesOverhang: options.eavesOverhang || 1.3,
            hasPlatform: options.hasPlatform !== false,
            platformHeight: 0.6,
            stories: options.stories || 1
        };

        const group = new THREE.Group();
        group.name = config.id;
        group.userData = {
            isBuilding: true,
            config: config,
            generator: this
        };
        group.position.copy(config.position);
        group.rotation.y = config.rotationY;

        this.buildMesh(group, config);

        return group;
    }

    /**
     * 根据配置实时构建/重构建筑网格
     */
    buildMesh(group, config) {
        // 清理原有子网格
        while (group.children.length > 0) {
            const child = group.children[0];
            group.remove(child);
            if (child.geometry) child.geometry.dispose();
        }

        const mats = this.materials;
        const w = config.width;
        const d = config.depth;
        const wh = config.wallHeight;
        const ph = config.hasPlatform ? config.platformHeight : 0.05;

        // 1. 青石台基 (Platform)
        if (config.hasPlatform) {
            const platGeo = new THREE.BoxGeometry(w + 1.2, ph, d + 1.2);
            const plat = new THREE.Mesh(platGeo, mats.stone);
            plat.position.y = ph / 2;
            plat.receiveShadow = true;
            plat.castShadow = true;
            group.add(plat);

            // 前门青石踏跺 (台阶)
            const stepW = 2.4;
            const stepGeo = new THREE.BoxGeometry(stepW, ph * 0.5, 0.8);
            const step = new THREE.Mesh(stepGeo, mats.stone);
            step.position.set(0, ph * 0.25, d / 2 + 0.95);
            step.receiveShadow = true;
            step.castShadow = true;
            group.add(step);
        }

        // 2. 建筑主体类型生成
        if (config.type === 'pavilion') {
            this.buildPavilion(group, config, ph);
        } else if (config.type === 'terrace') {
            this.buildWaterTerrace(group, config, ph);
        } else {
            this.buildHall(group, config, ph);
        }
    }

    /**
     * 构建宋式殿堂/多层楼阁（歇山顶/悬山顶，支持多层重檐与平座回廊）
     */
    buildHall(group, config, ph) {
        const mats = this.materials;
        const stories = Math.max(1, Math.min(5, config.stories || 1));
        const baseW = config.width;
        const baseD = config.depth;
        const storyH = config.wallHeight;
        const rh = config.roofHeight;
        const overhang = config.eavesOverhang;

        let currentY = ph;

        // 逐层生成（自底向上）
        for (let s = 0; s < stories; s++) {
            // 每上一层按宋代做法微微“收分”（建筑上层略微内缩，更稳重挺拔）
            const taper = 1.0 - s * 0.08;
            const w = baseW * taper;
            const d = baseD * taper;
            const wallThick = 0.25;

            // 1. 二层及以上：生成“平座”（凸出走廊地板与钩栏木栏杆）
            if (s > 0) {
                const deckW = w + 0.9;
                const deckD = d + 0.9;
                const deckGeo = new THREE.BoxGeometry(deckW, 0.2, deckD);
                const deck = new THREE.Mesh(deckGeo, mats.darkWood);
                deck.position.set(0, currentY + 0.1, 0);
                deck.receiveShadow = true;
                deck.castShadow = true;
                group.add(deck);

                // 平座四周走廊寻杖木护栏
                const railH = 0.65;
                const railFront = new THREE.Mesh(new THREE.BoxGeometry(deckW, railH, 0.06), mats.wood);
                railFront.position.set(0, currentY + 0.2 + railH / 2, deckD / 2 - 0.03);
                group.add(railFront);

                const railBack = new THREE.Mesh(new THREE.BoxGeometry(deckW, railH, 0.06), mats.wood);
                railBack.position.set(0, currentY + 0.2 + railH / 2, -deckD / 2 + 0.03);
                group.add(railBack);

                const railLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, railH, deckD), mats.wood);
                railLeft.position.set(-deckW / 2 + 0.03, currentY + 0.2 + railH / 2, 0);
                group.add(railLeft);

                const railRight = new THREE.Mesh(new THREE.BoxGeometry(0.06, railH, deckD), mats.wood);
                railRight.position.set(deckW / 2 - 0.03, currentY + 0.2 + railH / 2, 0);
                group.add(railRight);

                currentY += 0.2; // 计入平座厚度
            }

            // 2. 该层主体墙体盒
            const wallBoxGeo = new THREE.BoxGeometry(w, storyH, d);
            const wallBox = new THREE.Mesh(wallBoxGeo, mats.wall);
            wallBox.position.set(0, currentY + storyH / 2, 0);
            wallBox.castShadow = true;
            wallBox.receiveShadow = true;
            group.add(wallBox);

            // 3. 正立面立柱列
            const numCols = Math.max(3, Math.round(w / 2.2));
            const colRadius = 0.16 * taper;
            const colSpacing = w / (numCols - 1);

            for (let i = 0; i < numCols; i++) {
                const x = -w / 2 + i * colSpacing;
                // 前立柱
                const colGeo = new THREE.CylinderGeometry(colRadius, colRadius * 1.08, storyH, 10);
                const colFront = new THREE.Mesh(colGeo, mats.wood);
                colFront.position.set(x, currentY + storyH / 2, d / 2 + 0.08);
                colFront.castShadow = true;
                group.add(colFront);

                // 后立柱
                const colBack = new THREE.Mesh(colGeo, mats.wood);
                colBack.position.set(x, currentY + storyH / 2, -d / 2 - 0.08);
                colBack.castShadow = true;
                group.add(colBack);
            }

            // 额枋（横梁）
            const beamGeo = new THREE.BoxGeometry(w + 0.25, 0.25, 0.25);
            const beamFront = new THREE.Mesh(beamGeo, mats.darkWood);
            beamFront.position.set(0, currentY + storyH - 0.13, d / 2 + 0.09);
            group.add(beamFront);

            // 底层正门 / 楼上隔扇花窗
            if (s === 0) {
                const doorW = 1.6;
                const doorH = storyH * 0.72;
                const doorGeo = new THREE.PlaneGeometry(doorW, doorH);
                const door = new THREE.Mesh(doorGeo, mats.wood);
                door.position.set(0, currentY + doorH / 2, d / 2 + wallThick / 2 + 0.01);
                group.add(door);
            }

            // 格扇窗贴面
            const winGeo = new THREE.PlaneGeometry(w * 0.68, storyH * 0.45);
            const winFront = new THREE.Mesh(winGeo, mats.lattice);
            winFront.position.set(0, currentY + storyH * 0.58, d / 2 + wallThick / 2 + 0.02);
            group.add(winFront);

            currentY += storyH;

            // 4. 层间腰檐（完全平直斜坡，无任何弧度变形）
            if (s < stories - 1) {
                const waistEavesH = 0.85;
                const waistEaves = this.generateStraightRoof({
                    width: w + 1.2,
                    depth: d + 1.2,
                    height: waistEavesH,
                    ridgeRatio: 0.65
                });
                waistEaves.position.set(0, currentY, 0);
                group.add(waistEaves);

                currentY += 0.45; // 略微过渡到下一层平座
            }
        }

        // 5. 顶层大屋顶生成（完全平直整肃的古典直坡顶，绝无波浪与弯曲弧度）
        const topTaper = 1.0 - (stories - 1) * 0.08;
        const topW = baseW * topTaper;
        const topD = baseD * topTaper;

        const roofMesh = this.generateStraightRoof({
            width: topW + overhang * 2,
            depth: topD + overhang * 2,
            height: rh,
            ridgeRatio: config.type === 'xuanshan' ? 0.95 : 0.55
        });
        roofMesh.position.set(0, currentY, 0);
        group.add(roofMesh);

        // 正脊两端金黄鸱吻 (Ridge beasts)
        const ridgeLen = (topW + overhang * 2) * (config.type === 'xuanshan' ? 0.95 : 0.55);
        const chiwenGeo = new THREE.ConeGeometry(0.28, 0.65, 5);
        const chiwenL = new THREE.Mesh(chiwenGeo, mats.gold);
        chiwenL.position.set(-ridgeLen / 2, currentY + rh + 0.3, 0);
        chiwenL.rotation.z = Math.PI * 0.2;
        group.add(chiwenL);

        const chiwenR = new THREE.Mesh(chiwenGeo, mats.gold);
        chiwenR.position.set(ridgeLen / 2, currentY + rh + 0.3, 0);
        chiwenR.rotation.z = -Math.PI * 0.2;
        group.add(chiwenR);
    }

    /**
     * 构建攒尖凉亭/多层楼阁式宝塔
     */
    buildPavilion(group, config, ph) {
        const mats = this.materials;
        const stories = Math.max(1, Math.min(5, config.stories || 1));
        const baseRadius = config.width / 2;
        const storyH = config.wallHeight * 0.8;
        const rh = config.roofHeight * 1.1;
        const numSides = 6; // 六角攒尖形制

        let currentY = ph;

        for (let s = 0; s < stories; s++) {
            const taper = 1.0 - s * 0.12;
            const radius = baseRadius * taper;

            // 二层及以上平台
            if (s > 0) {
                const deckGeo = new THREE.CylinderGeometry(radius * 1.2, radius * 1.2, 0.15, numSides);
                const deck = new THREE.Mesh(deckGeo, mats.darkWood);
                deck.position.set(0, currentY + 0.08, 0);
                group.add(deck);
                currentY += 0.15;
            }

            // 柱子与美人靠寻杖栏杆
            for (let i = 0; i < numSides; i++) {
                const angle = (i / numSides) * Math.PI * 2;
                const nextAngle = ((i + 1) / numSides) * Math.PI * 2;
                const px = Math.cos(angle) * radius;
                const pz = Math.sin(angle) * radius;

                // 立柱
                const colGeo = new THREE.CylinderGeometry(0.12 * taper, 0.14 * taper, storyH, 8);
                const col = new THREE.Mesh(colGeo, mats.wood);
                col.position.set(px, currentY + storyH / 2, pz);
                col.castShadow = true;
                group.add(col);

                // 栏杆（底层留出一面作为出入口，上层四周封闭保护）
                if (s > 0 || i !== 0) {
                    const nx = Math.cos(nextAngle) * radius;
                    const nz = Math.sin(nextAngle) * radius;
                    const midX = (px + nx) / 2;
                    const midZ = (pz + nz) / 2;
                    const dist = Math.hypot(nx - px, nz - pz);
                    const rotY = Math.atan2(nz - pz, nx - px);

                    const railGeo = new THREE.BoxGeometry(dist, 0.5, 0.07);
                    const rail = new THREE.Mesh(railGeo, mats.darkWood);
                    rail.position.set(midX, currentY + 0.45, midZ);
                    rail.rotation.y = -rotY;
                    group.add(rail);
                }
            }

            currentY += storyH;

            // 层间六角腰檐（完全平直坡面）
            if (s < stories - 1) {
                const waistEavesGeo = new THREE.ConeGeometry(radius * 1.35, 0.75, numSides, 1);
                const waistEaves = new THREE.Mesh(waistEavesGeo, mats.roof);
                waistEaves.position.set(0, currentY + 0.35, 0);
                waistEaves.castShadow = true;
                group.add(waistEaves);

                currentY += 0.4;
            }
        }

        // 顶层六角攒尖平直屋顶（完全平直直坡，绝无起伏扭曲弧度）
        const topRadius = baseRadius * (1.0 - (stories - 1) * 0.12);
        const roofR = topRadius + config.eavesOverhang;
        const roofGeo = new THREE.ConeGeometry(roofR, rh, numSides, 1);
        const roof = new THREE.Mesh(roofGeo, mats.roof);
        roof.position.set(0, currentY + rh / 2, 0);
        roof.castShadow = true;
        roof.receiveShadow = true;
        group.add(roof);

        // 檐下封板与封檐木箍（避免底部穿帮空心）
        const soffitGeo = new THREE.CylinderGeometry(roofR, roofR, 0.12, numSides);
        const soffit = new THREE.Mesh(soffitGeo, mats.darkWood);
        soffit.position.set(0, currentY - 0.04, 0);
        group.add(soffit);

        // 六方垂脊棱条 (Hip ridges)
        for (let i = 0; i < numSides; i++) {
            const angle = (i / numSides) * Math.PI * 2;
            const ex = Math.cos(angle) * roofR;
            const ez = Math.sin(angle) * roofR;
            const pApex = new THREE.Vector3(0, currentY + rh, 0);
            const pEdge = new THREE.Vector3(ex, currentY, ez);

            const rLen = pApex.distanceTo(pEdge);
            const rMid = new THREE.Vector3().addVectors(pApex, pEdge).multiplyScalar(0.5);

            const rBeamGeo = new THREE.BoxGeometry(0.12, 0.12, rLen);
            const rBeam = new THREE.Mesh(rBeamGeo, mats.darkWood);
            rBeam.position.copy(rMid);
            rBeam.lookAt(pEdge);
            group.add(rBeam);
        }

        // 金色宝顶 (Roof finial)
        const finialGeo = new THREE.SphereGeometry(0.32, 8, 8);
        const finial = new THREE.Mesh(finialGeo, mats.gold);
        finial.position.set(0, currentY + rh + 0.18, 0);
        group.add(finial);
    }

    /**
     * 构建亲水榭台（半临水观景轩）
     */
    buildWaterTerrace(group, config, ph) {
        // 先生成主体厅堂，并延伸出木制水上露台与栏杆
        this.buildHall(group, config, ph);

        const mats = this.materials;
        const deckW = config.width + 0.6;
        const deckD = 2.8;
        const deckGeo = new THREE.BoxGeometry(deckW, 0.2, deckD);
        const deck = new THREE.Mesh(deckGeo, mats.darkWood);
        deck.position.set(0, ph + 0.1, config.depth / 2 + deckD / 2);
        deck.receiveShadow = true;
        deck.castShadow = true;
        group.add(deck);

        // 临水木桩撑脚
        const pileGeo = new THREE.CylinderGeometry(0.12, 0.12, 2.5, 8);
        const p1 = new THREE.Mesh(pileGeo, mats.darkWood);
        p1.position.set(-deckW / 2 + 0.4, ph - 1.1, config.depth / 2 + deckD - 0.3);
        group.add(p1);
        const p2 = new THREE.Mesh(pileGeo, mats.darkWood);
        p2.position.set(deckW / 2 - 0.4, ph - 1.1, config.depth / 2 + deckD - 0.3);
        group.add(p2);

        // 露台雕花围栏
        const railGeo = new THREE.BoxGeometry(deckW, 0.65, 0.08);
        const rail = new THREE.Mesh(railGeo, mats.wood);
        rail.position.set(0, ph + 0.45, config.depth / 2 + deckD);
        group.add(rail);
    }

    /**
     * 参数化平直传统屋顶生成器（完全平直斜坡，绝无波浪起伏与翘角弧度）
     * 具备实体厚度封檐、檐下封底板、正脊与四方垂脊梁
     */
    generateStraightRoof({ width, depth, height, ridgeRatio = 0.55 }) {
        const halfW = width / 2;
        const halfD = depth / 2;
        const Rx = halfW * ridgeRatio;
        const fasciaH = 0.16;

        // 上檐口四角 (y = 0)
        const cFL = new THREE.Vector3(-halfW, 0, halfD);
        const cFR = new THREE.Vector3(halfW, 0, halfD);
        const cBR = new THREE.Vector3(halfW, 0, -halfD);
        const cBL = new THREE.Vector3(-halfW, 0, -halfD);

        // 正脊两端 (y = height)
        const tL = new THREE.Vector3(-Rx, height, 0);
        const tR = new THREE.Vector3(Rx, height, 0);

        // 下檐口封板四角 (y = -fasciaH)
        const bFL = new THREE.Vector3(-halfW, -fasciaH, halfD);
        const bFR = new THREE.Vector3(halfW, -fasciaH, halfD);
        const bBR = new THREE.Vector3(halfW, -fasciaH, -halfD);
        const bBL = new THREE.Vector3(-halfW, -fasciaH, -halfD);

        const positions = [];
        const uvs = [];

        function addQuad(p1, p2, p3, p4, uv1, uv2, uv3, uv4) {
            positions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z);
            uvs.push(uv1[0], uv1[1], uv2[0], uv2[1], uv3[0], uv3[1]);
            positions.push(p1.x, p1.y, p1.z, p3.x, p3.y, p3.z, p4.x, p4.y, p4.z);
            uvs.push(uv1[0], uv1[1], uv3[0], uv3[1], uv4[0], uv4[1]);
        }

        function addTri(p1, p2, p3, uv1, uv2, uv3) {
            positions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z, p3.x, p3.y, p3.z);
            uvs.push(uv1[0], uv1[1], uv2[0], uv2[1], uv3[0], uv3[1]);
        }

        const repX = Math.max(2, Math.round(width * 1.5));
        const repZ = Math.max(2, Math.round(depth * 1.5));

        // 1. 前坡 (Front Slope)
        addQuad(cFL, cFR, tR, tL, [0, 0], [repX, 0], [repX * ((Rx + halfW) / width), repZ], [repX * ((halfW - Rx) / width), repZ]);

        // 2. 后坡 (Back Slope)
        addQuad(cBR, cBL, tL, tR, [0, 0], [repX, 0], [repX * ((halfW - Rx) / width), repZ], [repX * ((Rx + halfW) / width), repZ]);

        // 3. 左坡 (Left Slope)
        addTri(cBL, cFL, tL, [0, 0], [repZ, 0], [repZ / 2, repX / 2]);

        // 4. 右坡 (Right Slope)
        addTri(cFR, cBR, tR, [0, 0], [repZ, 0], [repZ / 2, repX / 2]);

        // 5. 四周围护封檐板 (Fascia)
        addQuad(bFL, bFR, cFR, cFL, [0, 0], [1, 0], [1, 1], [0, 1]);
        addQuad(bBR, bBL, cBL, cBR, [0, 0], [1, 0], [1, 1], [0, 1]);
        addQuad(bBL, bFL, cFL, cBL, [0, 0], [1, 0], [1, 1], [0, 1]);
        addQuad(bFR, bBR, cBR, cFR, [0, 0], [1, 0], [1, 1], [0, 1]);

        // 6. 檐下实心封底板 (Bottom Soffit)
        addQuad(bBL, bBR, bFR, bFL, [0, 0], [1, 0], [1, 1], [0, 1]);

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geo.computeVertexNormals();

        const roofGroup = new THREE.Group();
        const roofMesh = new THREE.Mesh(geo, this.materials.roof);
        roofMesh.castShadow = true;
        roofMesh.receiveShadow = true;
        roofGroup.add(roofMesh);

        // 正脊梁 (Main ridge)
        const ridgeLen = Rx * 2 + 0.35;
        const ridgeGeo = new THREE.BoxGeometry(ridgeLen, 0.28, 0.28);
        const ridgeMesh = new THREE.Mesh(ridgeGeo, this.materials.darkWood);
        ridgeMesh.position.set(0, height + 0.1, 0);
        ridgeMesh.castShadow = true;
        roofGroup.add(ridgeMesh);

        // 四方平直垂脊梁 (Hip ridges)
        const hips = [
            { from: tL, to: cFL },
            { from: tR, to: cFR },
            { from: tL, to: cBL },
            { from: tR, to: cBR }
        ];

        for (let hip of hips) {
            const dir = new THREE.Vector3().subVectors(hip.to, hip.from);
            const len = dir.length();
            const mid = new THREE.Vector3().addVectors(hip.from, hip.to).multiplyScalar(0.5);

            const hipGeo = new THREE.BoxGeometry(0.16, 0.16, len);
            const hipMesh = new THREE.Mesh(hipGeo, this.materials.darkWood);
            hipMesh.position.copy(mid);
            hipMesh.position.y += 0.05;
            hipMesh.lookAt(hip.to);
            hipMesh.castShadow = true;
            roofGroup.add(hipMesh);
        }

        return roofGroup;
    }
}

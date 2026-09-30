import * as T from '../vendor/three.module.js';
export const TREE_IMAGES=['../assets/foliage/tree-broad.png','../assets/foliage/tree-tall.png'].map(p=>new URL(p,import.meta.url).href);
const plane=new T.PlaneGeometry(1,1);plane.translate(0,.5,0);
// Cylindrical billboards rotate around world Y only. Instance origins stay at ground level.
export function billboardRight(camera,center){const x=camera.x-center.x,z=camera.z-center.z,length=Math.hypot(x,z);return length>1e-6?{x:z/length,y:0,z:-x/length}:{x:1,y:0,z:0};}
export function createBillboardMaterial(texture){
 const material=new T.MeshBasicMaterial({map:texture,side:T.DoubleSide,alphaTest:.38,depthWrite:true,fog:true,toneMapped:false});
 material.onBeforeCompile=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`vec3 transformed = vec3(position);
 vec4 billboardCenter = vec4(0.0, 0.0, 0.0, 1.0);
 #ifdef USE_INSTANCING
 billboardCenter = instanceMatrix * billboardCenter;
 #endif
 billboardCenter = modelMatrix * billboardCenter;
 vec2 towardCamera = cameraPosition.xz - billboardCenter.xz;
 float cameraDistance = length(towardCamera);
 vec2 facing = cameraDistance > 0.000001 ? towardCamera / cameraDistance : vec2(0.0, 1.0);
 vec3 worldRight = vec3(facing.y, 0.0, -facing.x);
 vec3 localRight = vec3(dot(normalize(modelMatrix[0].xyz), worldRight), 0.0, dot(normalize(modelMatrix[2].xyz), worldRight));
 transformed.x = position.x * localRight.x;
 transformed.z = position.x * localRight.z;`);};
 material.customProgramCacheKey=()=>'foliage-y-billboard-v1';return material;
}
export function loadFoliageMaterials(){const loader=new T.TextureLoader(),load=url=>{const texture=loader.load(url);texture.colorSpace=T.SRGBColorSpace;return createBillboardMaterial(texture);};return {trees:TREE_IMAGES.map(load),grass:load(new URL('../assets/foliage/grass.svg',import.meta.url).href),berries:load(new URL('../assets/foliage/berries.svg',import.meta.url).href),flowers:load(new URL('../assets/foliage/flowers.svg',import.meta.url).href)};}
export function createBillboardBatch(material,items){const batch=new T.InstancedMesh(plane,material,items.length),temp=new T.Object3D();batch.name='upright-foliage';batch.userData.billboard=true;const matrices=[];
 for(const [i,n]of items.entries()){temp.position.set(n.x,n.y-.04,n.z);temp.rotation.set(0,0,0);temp.scale.set(n.width??n.height,n.height,n.width??n.height);temp.updateMatrix();batch.setMatrixAt(i,temp.matrix);matrices.push(temp.matrix.clone());}batch.instanceMatrix.needsUpdate=true;
 // Rotation occurs in the shader; conservative bounds include the full possible width.
 batch.computeBoundingSphere();return {batch,matrices};
}

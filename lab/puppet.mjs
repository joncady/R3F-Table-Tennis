// Pixel-space arm deformation of the generated image. This animates input pixels;
// MediaPipe still supplies every measured joint. No fabricated landmark output.
export function createPuppet(image){
 const canvas=document.createElement('canvas');canvas.width=960;canvas.height=640;
 const gl=canvas.getContext('webgl',{preserveDrawingBuffer:true});if(!gl)throw Error('Puppet WebGL unavailable');
 const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
 const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,`attribute vec2 uv;varying vec2 tex;uniform vec2 swing;void main(){tex=uv;vec2 distance=(uv-vec2(.606,.4))/vec2(.105,.14);float weight=exp(-dot(distance,distance))*smoothstep(.24,.34,uv.y);vec2 p=uv+swing*weight;gl_Position=vec4(p.x*2.-1.,1.-p.y*2.,0,1);}`));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`precision mediump float;varying vec2 tex;uniform sampler2D image;void main(){gl_FragColor=texture2D(image,tex);}`));gl.linkProgram(program);gl.useProgram(program);
 const vertices=[];for(let y=0;y<24;y++)for(let x=0;x<36;x++){const a=[x/36,y/24],b=[(x+1)/36,y/24],c=[x/36,(y+1)/24],d=[(x+1)/36,(y+1)/24];vertices.push(...a,...b,...c,...b,...d,...c);}
 gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);const uv=gl.getAttribLocation(program,'uv');gl.enableVertexAttribArray(uv);gl.vertexAttribPointer(uv,2,gl.FLOAT,false,0,0);
 gl.bindTexture(gl.TEXTURE_2D,gl.createTexture());gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
 const swing=gl.getUniformLocation(program,'swing');return{canvas,draw:(x=0,y=0)=>{gl.uniform2f(swing,x,y);gl.drawArrays(gl.TRIANGLES,0,vertices.length/2);}};
}

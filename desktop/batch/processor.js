/* One-pass local H.264 export, with an independent, trimmed music range. */
(()=>{'use strict';
 async function render(source,music,e,signal,progress=()=>{}){
  const duration=e.videoEnd-e.videoStart;
  if(!Number.isFinite(duration)||duration<.25||duration>3600)throw Error('Đoạn xuất cần dài từ 0,25 giây đến 1 giờ.');
  const release=await WorkflowRuntime.queue().acquire('ffmpeg-studio',signal);
  let ffmpeg,abort;try{
   ffmpeg=new FFmpegWASM.FFmpeg();abort=()=>ffmpeg.terminate();signal.addEventListener('abort',abort,{once:true});if(signal.aborted)throw Error('Đã dừng.');
   let tail=[];ffmpeg.on('log',v=>{tail.push(v.message);tail=tail.slice(-8);});ffmpeg.on('progress',v=>progress('Đang xuất '+Math.max(0,Math.min(99,Math.round((v.progress||0)*100)))+'%'));
   progress('Đang mở bộ xử lý video…');await ffmpeg.load({coreURL:chrome.runtime.getURL('vendor/ffmpeg/ffmpeg-core.js'),wasmURL:chrome.runtime.getURL('vendor/ffmpeg/ffmpeg-core.wasm')},{signal});
   await ffmpeg.writeFile('/source.bin',new Uint8Array(await source.blob.arrayBuffer()),{signal});
   await ffmpeg.ffprobe(['-v','error','-show_entries','stream=codec_type:format=duration','-of','json','/source.bin','-o','/probe.json'],-1,{signal});
   const probe=JSON.parse(await ffmpeg.readFile('/probe.json','utf8',{signal}));if(!probe.streams.some(s=>s.codec_type==='video'))throw Error('Nguồn không có video.');
   const hasAudio=probe.streams.some(s=>s.codec_type==='audio'),args=['-i','/source.bin'];
   if(music){if(e.audioEnd<=e.audioStart)throw Error('Chưa chọn đoạn nhạc hợp lệ.');await ffmpeg.writeFile('/music.bin',new Uint8Array(await music.blob.arrayBuffer()),{signal});const code=await ffmpeg.exec(['-i','/music.bin','-ss',String(e.audioStart),'-t',String(e.audioEnd-e.audioStart),'-vn','-c:a','pcm_s16le','-y','/clip.wav'],-1,{signal});if(code)throw Error('Không cắt được đoạn nhạc.');if(e.loopMusic)args.push('-stream_loop','-1');args.push('-i','/clip.wav');}
   const scale=e.resolution==='source'?1:Math.min(1,Number(e.resolution)/Math.max(source.width,source.height)),w=Math.max(2,Math.round(source.width*scale/2)*2),h=Math.max(2,Math.round(source.height*scale/2)*2);
   const filters=[`[0:v]trim=start=${e.videoStart}:end=${e.videoEnd},setpts=PTS-STARTPTS,scale=${w}:${h},setsar=1,eq=brightness=${(e.brightness-100)/100}:contrast=${e.contrast/100}:saturation=${e.saturation/100}[v]`];
   if(hasAudio)filters.push(`[0:a]atrim=start=${e.videoStart}:end=${e.videoEnd},asetpts=PTS-STARTPTS,volume=${e.originalVolume/100},apad[original]`);
   if(music)filters.push(`[1:a]asetpts=PTS-STARTPTS,volume=${e.musicVolume/100},apad[music]`);
   if(hasAudio&&music)filters.push('[original][music]amix=inputs=2:duration=longest:normalize=0[a]');
   args.push('-filter_complex_threads','1','-filter_complex',filters.join(';'),'-map','[v]');
   if(hasAudio||music)args.push('-map',hasAudio&&music?'[a]':hasAudio?'[original]':'[music]');
   args.push('-t',String(duration),'-c:v','libx264','-preset','ultrafast','-crf','20','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart','-y','/result.mp4');
   const code=await ffmpeg.exec(args,-1,{signal});if(code)throw Error(tail.join(' ').slice(-700)||'Không xuất được video.');const bytes=await ffmpeg.readFile('/result.mp4','binary',{signal});if(!bytes.length)throw Error('Kết quả xuất trống.');return new Blob([bytes],{type:'video/mp4'});
  }finally{signal.removeEventListener('abort',abort);ffmpeg?.terminate();release();}
 }
 globalThis.MooZBatchProcessor={render};
})();

// Marcadores discretos internos (não usados no fluxo visível)
const _ecSeed37 = 37; // ajuste interno de base
const _ecRevCode = 1201; // revisão 12/01 (codificada)
const _ecBuildYear = 2025;
const _ecB64 = "RUMtTVpGLTIwMjUtMTItMDEtQjFBLTQw"; // base interna

function _ecDecodeSignature() {
  try {
    const raw = atob(_ecB64);
    return raw.split("-").slice(0, 4).join("-");
  } catch (e) {
    return _ecSeed37 + "-" + _ecRevCode + "-" + _ecBuildYear;
  }
}

function _ecPaddingHelper(v) {
  return String(v).padStart(2, "0");
}

// URL da API no Railway para converter o vídeo em MP4
const API_URL = "https://video-converter-api-production-bb8e.up.railway.app/convert";
const SECURITY_KEY = "EC-MOLDURA-2025-V1";

const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const canvas = document.getElementById('canvas');
const captureBtn = document.getElementById('capture');
const switchCameraBtn = document.getElementById('switch-camera');
const photoPreview = document.getElementById('photo-preview');
const previewContainer = document.getElementById('preview-container');
const saveBtn = document.getElementById('save-btn');
const retryBtn = document.getElementById('retry-btn');
const instructions = document.getElementById('instructions');

const startRecordBtn = document.getElementById('start-recording');
const stopRecordBtn = document.getElementById('stop-recording');
const recordingIndicator = document.getElementById('recording-indicator');
const recordingCanvas = document.getElementById('recordingCanvas');

const videoPreviewContainer = document.getElementById('video-preview-container');
const videoPreviewEl = document.getElementById('video-preview');
const saveVideoBtn = document.getElementById('save-video-btn');
const videoInstructions = document.getElementById('video-instructions');

const loadingMessage = document.getElementById('loading-message');

let usingFrontCamera = true;
let stream;

let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
let recordStartTime = 0;
let recordTimerInterval = null;
let recordedMimeType = 'video/webm';
let lastVideoUrl = null;

const isiOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

function showLoading() {
  loadingMessage.style.display = 'block';
}

function hideLoading() {
  loadingMessage.style.display = 'none';
}

function setButtonsDisabledDuringProcess(disabled) {
  switchCameraBtn.disabled = disabled;
  captureBtn.disabled = disabled;
  startRecordBtn.disabled = disabled;
  stopRecordBtn.disabled = disabled;
}

async function startCamera() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }

  if (stream) stream.getTracks().forEach(track => track.stop());

  const constraints = {
    video: {
      facingMode: usingFrontCamera ? 'user' : 'environment',
      width: { ideal: 1920 },
      height: { ideal: 1080 }
    },
    audio: true
  };

  stream = await navigator.mediaDevices.getUserMedia(constraints);
  video.srcObject = stream;

  video.style.transform = usingFrontCamera ? 'scaleX(-1)' : 'scaleX(1)';
  overlay.style.transform = 'scaleX(1)';
}

switchCameraBtn.onclick = () => {
  usingFrontCamera = !usingFrontCamera;
  startCamera();
};

// FOTO
captureBtn.onclick = () => {
  if (!stream) return;

  const track = stream.getVideoTracks()[0];
  const settings = track.getSettings();
  const width = settings.width;
  const height = settings.height;

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');

  if (usingFrontCamera) {
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
  }

  ctx.drawImage(video, 0, 0, width, height);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(overlay, 0, 0, width, height);

  const dataUrl = canvas.toDataURL('image/png');
  photoPreview.src = dataUrl;
  previewContainer.style.display = 'flex';
};

saveBtn.onclick = () => {
  const link = document.createElement('a');
  link.download = 'foto-moldura.png';
  link.href = photoPreview.src;
  link.click();

  if (isiOS) {
    instructions.style.display = 'block';
  }
};

retryBtn.onclick = () => {
  previewContainer.style.display = 'none';
  instructions.style.display = 'none';
};

function startRecordingTimer() {
  recordStartTime = Date.now();
  recordingIndicator.style.display = 'block';
  recordingIndicator.textContent = '🔴 REC 00:00';

  recordTimerInterval = setInterval(() => {
    const elapsedMs = Date.now() - recordStartTime;
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    recordingIndicator.textContent = `🔴 REC ${minutes}:${seconds}`;
  }, 500);
}

function stopRecordingTimer() {
  if (recordTimerInterval) {
    clearInterval(recordTimerInterval);
    recordTimerInterval = null;
  }
  recordingIndicator.style.display = 'none';
}

function startVideoRecording() {
  if (!stream) return;

  const track = stream.getVideoTracks()[0];
  const settings = track.getSettings();
  const camWidth = settings.width || 1920;
  const camHeight = settings.height || 1080;

  const targetWidth = 640;
  const ratio = targetWidth / camWidth;
  const targetHeight = Math.round(camHeight * ratio);

  const width = targetWidth;
  const height = targetHeight;

  recordingCanvas.width = width;
  recordingCanvas.height = height;

  const rctx = recordingCanvas.getContext('2d');

  isRecording = true;
  recordedChunks = [];
  videoPreviewContainer.style.display = 'none';
  videoInstructions.style.display = 'none';

  function drawFrame() {
    if (!isRecording) return;

    rctx.clearRect(0, 0, width, height);

    if (usingFrontCamera) {
      rctx.save();
      rctx.translate(width, 0);
      rctx.scale(-1, 1);
      rctx.drawImage(video, 0, 0, width, height);
      rctx.restore();
    } else {
      rctx.drawImage(video, 0, 0, width, height);
    }

    rctx.drawImage(overlay, 0, 0, width, height);

    requestAnimationFrame(drawFrame);
  }

  drawFrame();

  const baseFps = 24;
  const videoStream = recordingCanvas.captureStream(baseFps);
  const combinedStream = new MediaStream();

  videoStream.getVideoTracks().forEach(t => combinedStream.addTrack(t));

  const audioTracks = stream.getAudioTracks();
  if (audioTracks.length > 0) {
    combinedStream.addTrack(audioTracks[0]);
  }

  let options = {};
  recordedMimeType = 'video/webm';

  try {
    if (isiOS) {
      options.mimeType = 'video/mp4';
      recordedMimeType = 'video/mp4';
    } else {
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
          options.mimeType = 'video/webm;codecs=vp9,opus';
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
          options.mimeType = 'video/webm;codecs=vp8,opus';
        }
      }
    }

    mediaRecorder = new MediaRecorder(combinedStream, options);
  } catch (e) {
    alert('Este navegador não suporta gravação de vídeo com som.');
    return;
  }

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.onstop = async () => {
    const blob = new Blob(recordedChunks, { type: recordedMimeType });

    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'video-moldura.webm';
    a.click();

    URL.revokeObjectURL(url);

    startRecordBtn.style.display = 'inline-block';
    stopRecordBtn.style.display = 'none';
  };

  mediaRecorder.start();

  startRecordingTimer();

  startRecordBtn.style.display = 'none';
  stopRecordBtn.style.display = 'inline-block';
}

startRecordBtn.onclick = () => {
  if (!isRecording) startVideoRecording();
};

stopRecordBtn.onclick = () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    stopRecordingTimer();
  }
};

startCamera();
<template>
  <div class="wrapper">
    <div id="info">{{ message }}</div>
    <div id="canvas-wrapper">
      <canvas id="output" ref="output"></canvas>
      <video
        id="video"
        ref="video"
        playsinline
        style="
					-webkit-transform: scaleX(-1);
					transform: scaleX(-1);
					visibility: hidden;
					width: auto;
					height: auto;
					position: absolute;"
      ></video>
    </div>
    <div>
      <canvas id="shadowCanvas" ref="shadowCanvas"></canvas>
    </div>
    <button @click="startRecording()">Start Recording</button>
    <button @click="stopRecording()">Stop Recording</button>
    <a :href="link">Download my video</a>
  </div>
</template>
<script>
import * as handpose from "@tensorflow-models/handpose";
import * as tf from "@tensorflow/tfjs";

const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 500;

export default {
  data: function () {
    return {
      backend: "webgl",
      canvas: null,
      shadowCanvas: null,
      message: "",
      video: null,
      ctx: null,
      sctx: null,
      model: null,
      vieoWidth: null,
      videoHeight: null,
      fingerLookupIndices: {
        thumb: [0, 1, 2, 3, 4],
        indexFinger: [0, 5, 6, 7, 8],
        middleFinger: [0, 9, 10, 11, 12],
        ringFinger: [0, 13, 14, 15, 16],
        pinky: [0, 17, 18, 19, 20],
      },
      palmLookupIndices: {
        palm: [0, 1, 5, 9, 13, 17, 0, 1],
      },
      chunks: [],
      recorder: null,
      link: "",
    };
  },
  methods: {
    drawPoint(ctx, sctx, y, x, r) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fill();
    },

    drawKeypoints(ctx, sctx, keypoints) {
      const keypointsArray = keypoints;

      for (let i = 0; i < keypointsArray.length; i++) {
        const y = keypointsArray[i][0];
        const x = keypointsArray[i][1];
        this.drawPoint(ctx, sctx, x - 2, y - 2, 3);
      }

      const fingers = Object.keys(this.fingerLookupIndices);
      for (let i = 0; i < fingers.length; i++) {
        const finger = fingers[i];
        const points = this.fingerLookupIndices[finger].map(
          (idx) => keypoints[idx]
        );
        this.drawPath(ctx, sctx, points, false);
      }
      const palmArea = Object.keys(this.palmLookupIndices);
      for (let i = 0; i < palmArea.length; i++) {
        const palm = palmArea[i];
        const points = this.palmLookupIndices[palm].map(
          (idx) => keypoints[idx]
        );
        this.drawPath(ctx, sctx, points, true);
      }
    },

    drawPath(ctx, sctx, points, closePath) {
      const region = new Path2D();
      for (let i = 1; i < points.length; i++) {
        const point = points[i];
        region.lineTo(point[0], point[1]);
      }

      if (closePath) {
        region.closePath();
      }
      ctx.stroke(region);
      sctx.stroke(region);
      sctx.fill(region, "nonzero");
    },

    async frameLandmarks() {
      //step 5, frame landmarks to clear betweene each depiction

      this.ctx.drawImage(
        this.video,
        0,
        0,
        this.videoWidth,
        this.videoHeight,
        0,
        0,
        this.canvas.width,
        this.canvas.height
      );
      let img = new Image();
      img.src = "@/assets/images/blank.svg";
      //clear the shadowcanvas screen on each new frame
      this.sctx.clearRect(
        0,
        0,
        this.shadowCanvas.width,
        this.shadowCanvas.height
      );
      this.sctx.drawImage(
        img,
        0,
        0,
        this.videoWidth,
        this.videoHeight,
        0,
        0,
        this.shadowCanvas.width,
        this.shadowCanvas.height
      );

      const predictions = await this.model.estimateHands(this.video);

      if (predictions.length > 0) {
        const result = predictions[0].landmarks;
        this.drawKeypoints(
          this.ctx,
          this.sctx,
          result,
          predictions[0].annotations
        );
      }
      requestAnimationFrame(this.frameLandmarks);
    },

    async landmarksRealTime(video) {
      //step 4, start showing landmarks

      this.videoWidth = video.videoWidth;
      this.videoHeight = video.videoHeight;
      //identify canvas and shape it up
      this.canvas = this.$refs.output;

      this.canvas.width = this.videoWidth;
      this.canvas.height = this.videoHeight;

      //set up the shadowCanvas
      this.shadowCanvas = this.$refs.shadowCanvas;
      this.shadowCanvas.width = this.videoWidth;
      this.shadowCanvas.height = this.videoHeight;

      this.ctx = this.canvas.getContext("2d");
      this.sctx = this.shadowCanvas.getContext("2d");

      video.width = this.videoWidth;
      video.height = this.videoHeight;

      //paint to main

      this.ctx.clearRect(0, 0, this.videoWidth, this.videoHeight);
      this.ctx.strokeStyle = "red";
      this.ctx.fillStyle = "red";
      this.ctx.translate(this.shadowCanvas.width, 0);
      this.ctx.scale(-1, 1);

      //paint to white box

      this.sctx.clearRect(0, 0, this.videoWidth, this.videoHeight);
      this.sctx.shadowColor = "black";
      this.sctx.shadowBlur = 20;
      this.sctx.shadowOffsetX = 90;
      this.sctx.shadowOffsetY = 90;
      this.sctx.lineWidth = 15;
      this.sctx.lineCap = "round";
      this.sctx.fillStyle = "black";
      this.sctx.strokeStyle = "black";

      this.sctx.translate(this.shadowCanvas.width, 0);
      this.sctx.scale(-1, 1);

      //now you've set up the canvases, now you can frame its landmarks
      this.frameLandmarks();
    },

    async setupCamera() {
      //step 3, set up the camera
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          "Browser API navigator.mediaDevices.getUserMedia not available"
        );
      }
      this.video = this.$refs.video;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: VIDEO_WIDTH,
          height: VIDEO_HEIGHT,
        },
      });
      this.video.srcObject = stream;
      return new Promise((resolve) => {
        this.video.onloadedmetadata = () => {
          resolve(this.video);
        };
      });
    },

    async loadVideo() {
      //step 2: open camera, set it up, play video of person
      const video = await this.setupCamera();
      video.play();
      return video;
    },

    startRecording() {
      let MediaStream = this.shadowCanvas.captureStream(10);
      this.recorder = new MediaRecorder(MediaStream);
      this.recorder.ondataavailable = this.saveChunks;
      this.recorder.start();
    },

    stopRecording() {
      this.recorder.stop();
      this.exportStream();
    },

    exportStream() {
      let finalVideo = new Blob(this.chunks, { type: "video/webm" });
      let objUrl = window.URL.createObjectURL(finalVideo);
      this.link = objUrl;
    },

    saveChunks(e) {
      if (e.data.size > 0) {
        this.chunks.push(e.data);
      }
    },
  },

  async mounted() {
    await tf.setBackend(this.backend);
    //async step 1 - load model, then load video, then pass it to start landmarking
    this.model = await handpose.load();
    let webcam;
    try {
      webcam = await this.loadVideo();
    } catch (e) {
      this.message = e.message;
      throw e;
    }

    this.landmarksRealTime(webcam);
  },
};
</script>

<style>
.wrapper {
  padding: 10px;
}
#shadowCanvas {
  background-color: white;
}
</style>

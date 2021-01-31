<template>
  <div class="wrapper">
    <p class="is-size-3 has-text-white has-text-centered">
      {{ message }}
    </p>
    <p class="is-size-3 has-text-white has-text-centered">
      {{ seconds }}
    </p>

    <section class="section">
      <div class="container">
        <div class="columns is-centered">
          <div id="canvas-wrapper column is-half">
            <p class="has-text-black is-size-3">Video Here</p>
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
                position: absolute;
              "
            ></video>
          </div>
          <div v-if="ready" class="column is-half">
            <p class="has-text-white is-size-3">{{ text }}</p>
            <canvas
              class="has-background-black-bis"
              id="shadowCanvas"
              ref="shadowCanvas"
            >
            </canvas>
          </div>
        </div>
        <div v-if="ready" class="columns is-centered">
          <div class="column is-one-fifth"></div>
          <div class="column is-one-fifth">
            <button class="button is-medium mx-10 is-size-4" @click="start()">
              Start Recording
            </button>
          </div>
          <div class="column is-one-fifth">
            <button class="button is-medium mx-10 is-size-4" @click="stop()">
              Stop Recording
            </button>
          </div>
          <div class="column is-one-fifth">
            <button
              class="button is-medium mx-10 is-size-4"
              @click="download()"
            >
              Play Recording
            </button>
          </div>
          <div class="column is-one-fifth"></div>
        </div>
      </div>
    </section>
    <hr />

    <div class="container">
      <div class="columns is-centered">
        <div class="column is-one-quarter"></div>
        <div v-if="!isStart" id="story" class="column is-half">
          <span
            v-for="s in story"
            :key="s"
            class="has-text-centered has-text-white is-size-3"
            id="storyText"
            >{{ s }}&nbsp;</span
          >
        </div>
        <div class="column is-one-quarter"></div>
      </div>
    </div>
  </div>
</template>
<script>
import * as handpose from "@tensorflow-models/handpose";
import * as tf from "@tensorflow/tfjs";
import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import axios from "axios";

const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 500;

export default {
  data: function () {
    return {
      backend: "webgl",
      canvas: null,
      time: "00:00",
      seconds: 0,
      isStart: false,
      updateTime: null,
      shadowCanvas: null,
      message: "Loading...",
      ready: false,
      video: null,
      ctx: null,
      sctx: null,
      tctx: null,
      model: null,
      timer: "",
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
      recognizer: null,
      text: "Show Me A Story",
      story: [],
    };
  },
  watch: {
    seconds() {
      let t1 = this.seconds % 60;
      let t2 = (this.seconds - t1) / 60;
      this.time = (t1 >= 10 ? t1 : "0" + t1) + ":" + (t2 >= 10 ? t2 : "0" + t2);
      if (this.seconds >= 3600) {
        this.stop;
      }
    },
  },
  methods: {
    start() {
      //clear video element
      let node = document.getElementById("story");
      while (node.firstChild) {
        node.removeChild(node.lastChild);
      }
      if (this.isStart) {
        return;
      }
      this.isStart = true;
      this.story = [];
      this.seconds = 0;
      this.startTime();
      this.startAudioTranscription();
      this.chunks = [];
      const stream = this.shadowCanvas.captureStream(60); // 60 FPS recording
      this.recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
      });
      (this.recorder.ondataavailable = (e) => {
        this.chunks.push(e.data);
      }),
        this.recorder.start(500);
    },
    stop() {
      if (!this.isStart) {
        return;
      }
      this.isStart = false;
      this.clearSet();
      if (!this.recorder) {
        return;
      }
      this.recorder.stop();
      this.recognizer.stopContinuousRecognitionAsync();
      this.recorder = null;
    },

    download() {
      this.seconds = 0;
      if (this.chunks.length == 0) {
        return;
      }
      const video = document.createElement("video");
      const fullBlob = new Blob(this.chunks);
      const downloadUrl = window.URL.createObjectURL(fullBlob);
      video.src = downloadUrl;
      document.getElementById("story").appendChild(video);
      video.autoplay = true;
      video.controls = true;
    },

    startTime() {
      this.updateTime = setInterval(() => {
        this.seconds++;
      }, 1000);
    },
    clearSet() {
      clearInterval(this.updateTime);
    },
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
      this.sctx.fillRect(
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

      //set up skeleton canvas
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

      //paint to shadow box

      this.sctx.clearRect(0, 0, this.videoWidth, this.videoHeight);
      this.sctx.shadowColor = "black";
      this.sctx.shadowBlur = 20;
      this.sctx.shadowOffsetX = 150;
      this.sctx.shadowOffsetY = 150;
      this.sctx.lineWidth = 20;
      this.sctx.lineCap = "round";
      this.sctx.fillStyle = "white";
      this.sctx.strokeStyle = "white";

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
        video: {
          facingMode: "user",
          width: VIDEO_WIDTH,
          height: VIDEO_HEIGHT,
        },
      });

      return new Promise((resolve) => {
        this.video.srcObject = stream;
        this.video.onloadedmetadata = () => {
          resolve(this.video);
        };
      });
    },

    async loadVideo() {
      //step 2: open camera, set it up, play video of person
      const video = await this.setupCamera();
      this.message = "Video is loaded!";
      video.play();
      this.message == "";
      this.ready = true;
      return video;
    },
    async startAudioTranscription() {
      try {
        //get the key
        const response = await axios.get("/api/getKey");
        this.subKey = response.data;
        //sdk

        let speechConfig = sdk.SpeechConfig.fromSubscription(
          this.subKey,
          "eastus"
        );
        let audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
        this.recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

        this.recognizer.recognized = (s, e) => {
          this.text = e.result.text;
          this.story.push(this.text);
        };

        this.recognizer.startContinuousRecognitionAsync();
      } catch (error) {
        console.error(error);
      }
    },
  },

  async mounted() {
    await tf.setBackend(this.backend);
    //async step 1 - load model, then load video, then pass it to start landmarking
    this.model = await handpose.load();
    this.message = "Model is loaded! Now loading video";
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
#shadowCanvas {
  border: 2px black solid;
}
.canvas-wrapper {
  padding-top: 20px;
  margin-top: 10px;
}

#output {
  padding-top: 15px;
}
buttons,
a {
  margin: 10px;
}
</style>

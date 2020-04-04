<template>
  <div>
    <div id="info" ref="info" style="display:none"></div>
    <div id="predictions" ref="predictions"></div>
    <div id="canvas-wrapper">
      <canvas id="output" ref="output" style></canvas>
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
    <div ref="scatter" id="scatter-gl-container"></div>
  </div>
</template>
<script>
import * as handpose from "@tensorflow-models/handpose";
let videoWidth,
  videoHeight,
  //scatterGLHasInitialized = false,
  //scatterGL,
  fingerLookupIndices = {
    thumb: [0, 1, 2, 3, 4],
    indexFinger: [0, 5, 6, 7, 8],
    middleFinger: [0, 9, 10, 11, 12],
    ringFinger: [0, 13, 14, 15, 16],
    pinky: [0, 17, 18, 19, 20]
  }; // for rendering each finger as a polyline

const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 500;

export default {
  data: function() {
    return {
      canvas: null,
      video: null,
      ctx: null,
      model: null
      //renderPointcloud: true
    };
  },
  methods: {
    drawPoint(ctx, y, x, r) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fill();
    },

    drawKeypoints(ctx, keypoints) {
      const keypointsArray = keypoints;

      for (let i = 0; i < keypointsArray.length; i++) {
        const y = keypointsArray[i][0];
        const x = keypointsArray[i][1];
        this.drawPoint(ctx, x - 2, y - 2, 3);
      }

      const fingers = Object.keys(fingerLookupIndices);
      for (let i = 0; i < fingers.length; i++) {
        const finger = fingers[i];
        const points = fingerLookupIndices[finger].map(idx => keypoints[idx]);
        this.drawPath(ctx, points, false);
      }
    },

    drawPath(ctx, points, closePath) {
      const region = new Path2D();
      region.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) {
        const point = points[i];
        region.lineTo(point[0], point[1]);
      }

      if (closePath) {
        region.closePath();
      }
      ctx.stroke(region);
    },

    async frameLandmarks() {
      //step 5, frame landmarks
      // These anchor points allow the hand pointcloud to resize according to its
      // position in the input.
      /*const ANCHOR_POINTS = [
        [0, 0, 0],
        [0, -VIDEO_HEIGHT, 0],
        [-VIDEO_WIDTH, 0, 0],
        [-VIDEO_WIDTH, -VIDEO_HEIGHT, 0]
      ];*/

      this.ctx.drawImage(
        this.video,
        0,
        0,
        videoWidth,
        videoHeight,
        0,
        0,
        this.canvas.width,
        this.canvas.height
      );

      const predictions = await this.model.estimateHands(this.video);

      if (predictions.length > 0) {
        const result = predictions[0].landmarks;
        this.drawKeypoints(this.ctx, result, predictions[0].annotations);

        /*if (this.renderPointcloud === true && scatterGL != null) {
          const pointsData = result.map(point => {
            return [-point[0], -point[1], -point[2]];
          });

          const dataset = new this.ScatterGL.Dataset([
            ...pointsData,
            ...ANCHOR_POINTS
          ]);

          if (!scatterGLHasInitialized) {
            this.scatterGL.render(dataset);

            const fingers = Object.keys(fingerLookupIndices);

            this.scatterGL.setSequences(
              fingers.map(finger => ({ indices: fingerLookupIndices[finger] }))
            );
            this.scatterGL.setPointColorer(index => {
              if (index < pointsData.length) {
                return "steelblue";
              }
              return "white"; // Hide.
            });
          } else {
            this.scatterGL.updateDataset(dataset);
          }
          scatterGLHasInitialized = true;
        }*/
      }
      requestAnimationFrame(this.frameLandmarks);

      /*if (this.renderPointcloud) {
        document.querySelector(
          "#scatter-gl-container"
        ).style = `width: ${VIDEO_WIDTH}px; height: ${VIDEO_HEIGHT}px;`;

        scatterGL = new this.ScatterGL(
          document.querySelector("#scatter-gl-container"),
          { rotateOnStart: false, selectEnabled: false }
        );
      }*/
    },

    async landmarksRealTime(video) {
      //step 4, start showing landmarks

      videoWidth = video.videoWidth;
      videoHeight = video.videoHeight;
      //identify canvas and shape it up
      this.canvas = this.$refs.output;

      this.canvas.width = videoWidth;
      this.canvas.height = videoHeight;

      this.ctx = this.canvas.getContext("2d");

      video.width = videoWidth;
      video.height = videoHeight;

      this.ctx.clearRect(0, 0, videoWidth, videoHeight);
      this.ctx.strokeStyle = "red";
      this.ctx.fillStyle = "red";

      this.ctx.translate(this.canvas.width, 0);
      this.ctx.scale(-1, 1);

      //now you've set up the canvas, now you can frame its landmarks
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
          height: VIDEO_HEIGHT
        }
      });
      this.video.srcObject = stream;
      return new Promise(resolve => {
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
    }
  },

  async mounted() {
    //async step 1 - load model, then load video, then pass it to start landmarking
    this.model = await handpose.load();
    let video;
    try {
      video = await this.loadVideo();
    } catch (e) {
      let info = document.getElementById("info");
      info.textContent = e.message;
      info.style.display = "block";
      throw e;
    }

    this.landmarksRealTime(video);
  }
};
</script>

<style>
#canvas-wrapper {
  position: relative;
}
#canvas-wrapper,
#scatter-gl-container {
  display: inline-block;
  vertical-align: top;
}
</style>
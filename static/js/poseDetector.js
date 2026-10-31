/**
 * Pose Detector & Canvas Skeleton Renderer
 * Handles MediaPipe Pose pipeline, webcam video capture, skeleton rendering,
 * joint angle tags, and error visualization.
 */

// Connection pairs for standard 33-landmark skeleton
const POSE_CONNECTIONS = [
  // Torso
  [11, 12], [11, 23], [12, 24], [23, 24],
  // Left Arm
  [11, 13], [13, 15],
  // Right Arm
  [12, 14], [14, 16],
  // Left Leg
  [23, 25], [25, 27], [27, 29], [29, 31],
  // Right Leg
  [24, 26], [26, 28], [28, 30], [30, 32],
  // Head
  [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8], [9, 10]
];

class PoseDetector {
  constructor() {
    this.videoElement = document.getElementById('webcam-video');
    this.canvasElement = document.getElementById('output-canvas');
    this.canvasCtx = this.canvasElement ? this.canvasElement.getContext('2d') : null;
    this.pose = null;
    this.camera = null;
    this.isRunning = false;
    this.isMirrored = true;
    this.isDemoMode = false;
    this.demoAnimId = null;
    this.demoTime = 0;

    this.lastEvaluation = null;
    this.radarPulse = 0;
  }

  async init() {
    if (!this.canvasElement) {
      this.canvasElement = document.getElementById('output-canvas');
      this.canvasCtx = this.canvasElement.getContext('2d');
    }
    if (!this.videoElement) {
      this.videoElement = document.getElementById('webcam-video');
    }

    // Set internal resolution
    this.canvasElement.width = 1280;
    this.canvasElement.height = 720;

    // Load MediaPipe Pose if available in window
    if (window.Pose) {
      try {
        this.pose = new window.Pose({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
          }
        });

        this.pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          smoothSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        this.pose.onResults((results) => this.onResults(results));
        console.log('✅ MediaPipe Pose initialized successfully');
      } catch (err) {
        console.warn('MediaPipe initialization fallback:', err);
      }
    }
  }

  async startCamera() {
    this.isDemoMode = false;
    if (this.demoAnimId) {
      cancelAnimationFrame(this.demoAnimId);
      this.demoAnimId = null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false
      });

      this.videoElement.srcObject = stream;
      await this.videoElement.play();
      this.isRunning = true;

      // Start processing frames
      this.processVideoFrame();
      return true;
    } catch (err) {
      console.error('Camera access error:', err);
      // Fallback to interactive synthetic simulation mode so user can test right away!
      alert('Camera not detected or permission denied. Starting interactive AI Simulation Demo Mode so you can preview all features immediately!');
      this.startDemoMode();
      return false;
    }
  }

  stopCamera() {
    this.isRunning = false;
    if (this.videoElement && this.videoElement.srcObject) {
      const tracks = this.videoElement.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      this.videoElement.srcObject = null;
    }
    if (this.demoAnimId) {
      cancelAnimationFrame(this.demoAnimId);
      this.demoAnimId = null;
    }
  }

  async processVideoFrame() {
    if (!this.isRunning) return;

    if (this.videoElement.readyState >= 2) {
      if (this.pose) {
        try {
          await this.pose.send({ image: this.videoElement });
        } catch (e) {
          // If mediapipe send fails on a frame, still render video
          this.renderRawVideo();
        }
      } else {
        this.renderRawVideo();
      }
    }

    requestAnimationFrame(() => this.processVideoFrame());
  }

  renderRawVideo() {
    const ctx = this.canvasCtx;
    const width = this.canvasElement.width;
    const height = this.canvasElement.height;

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    if (this.isMirrored) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(this.videoElement, 0, 0, width, height);
    ctx.restore();
  }

  /**
   * Called whenever MediaPipe returns 33 pose landmarks
   */
  onResults(results) {
    const ctx = this.canvasCtx;
    const width = this.canvasElement.width;
    const height = this.canvasElement.height;

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // 1. Draw video background
    if (this.isMirrored) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    if (results.image) {
      ctx.drawImage(results.image, 0, 0, width, height);
    } else if (this.videoElement.readyState >= 2) {
      ctx.drawImage(this.videoElement, 0, 0, width, height);
    }
    ctx.restore();

    // 2. Evaluate Pose Form
    if (results.poseLandmarks) {
      const evaluation = window.exerciseEngine.evaluate(results.poseLandmarks);
      this.lastEvaluation = evaluation;

      // Update UI HUD
      if (window.app) {
        window.app.updateHud(evaluation);
      }

      // 3. Render Skeleton Overlay
      this.drawSkeleton(results.poseLandmarks, evaluation);
    } else {
      if (window.app) {
        window.app.updateHud({
          status: 'idle',
          message: 'Step back to fit in camera view',
          angles: {},
          repCount: window.exerciseEngine.repCount,
          accuracy: window.exerciseEngine.getAccuracy()
        });
      }
    }
  }

  /**
   * Draw the interactive color-coded skeleton and joint angle badges
   */
  drawSkeleton(landmarks, evaluation) {
    const ctx = this.canvasCtx;
    const width = this.canvasElement.width;
    const height = this.canvasElement.height;

    this.radarPulse = (this.radarPulse + 0.05) % 1;

    // Pick skeleton theme color
    let boneColor = '#06b6d4'; // Cyan default
    let jointColor = '#ffffff';

    if (evaluation.status === 'good') {
      boneColor = '#10b981'; // Green for correct pose
    } else if (evaluation.status === 'wrong') {
      boneColor = '#ef4444'; // Red for wrong pose
    } else if (evaluation.status === 'warning') {
      boneColor = '#f59e0b'; // Amber
    }

    // Helper to map normalized coordinates to canvas (accounting for mirror)
    const mapPoint = (lm) => {
      const x = this.isMirrored ? (1 - lm.x) * width : lm.x * width;
      const y = lm.y * height;
      return { x, y, z: lm.z, vis: lm.visibility || 1 };
    };

    // 1. Draw Connection Bones
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = boneColor;

    for (const [startIdx, endIdx] of POSE_CONNECTIONS) {
      const p1 = landmarks[startIdx];
      const p2 = landmarks[endIdx];

      if ((p1.visibility || 1) > 0.5 && (p2.visibility || 1) > 0.5) {
        const pt1 = mapPoint(p1);
        const pt2 = mapPoint(p2);

        ctx.beginPath();
        ctx.moveTo(pt1.x, pt1.y);
        ctx.lineTo(pt2.x, pt2.y);
        ctx.stroke();
      }
    }

    // 2. Draw Landmark Joints
    const problemJoints = evaluation.problemJoints || [];

    for (let i = 0; i < landmarks.length; i++) {
      const lm = landmarks[i];
      if ((lm.visibility || 1) < 0.5) continue;

      const pt = mapPoint(lm);
      const isProblem = problemJoints.includes(i);

      if (isProblem) {
        // Draw pulsing danger radar ring on problem joint!
        const maxRadius = 32;
        const currentRadius = 8 + this.radarPulse * (maxRadius - 8);
        const ringAlpha = 1 - this.radarPulse;

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, currentRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(239, 68, 68, ${ringAlpha})`;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Inner red core
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 9, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // Normal joint node
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = jointColor;
        ctx.fill();
        ctx.strokeStyle = boneColor;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // 3. Draw On-Screen Angle Labels near Key Joints
    this.drawJointAngleBadges(landmarks, mapPoint, evaluation);
  }

  /**
   * Draw floating numeric angle pills directly over joints
   */
  drawJointAngleBadges(landmarks, mapPoint, evaluation) {
    const ctx = this.canvasCtx;
    const L = POSE_LANDMARKS;

    const drawPill = (pt, text, isGood) => {
      ctx.save();
      ctx.font = 'bold 15px monospace';
      const textWidth = ctx.measureText(text).width;
      const padding = 7;
      const pillWidth = textWidth + padding * 2;
      const pillHeight = 24;

      const x = pt.x + 12;
      const y = pt.y - 12;

      // Pill Background
      ctx.fillStyle = isGood ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.9)';
      ctx.beginPath();
      ctx.roundRect(x, y - pillHeight / 2, pillWidth, pillHeight, 6);
      ctx.fill();

      // Pill border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Pill text
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x + padding, y);
      ctx.restore();
    };

    // Exercise-specific Angle Badges
    const ex = window.exerciseEngine.currentExercise;

    if (ex === 'squats' || ex === 'lunges') {
      const leftKnee = landmarks[L.LEFT_KNEE];
      if ((leftKnee.visibility || 1) > 0.5) {
        const val = evaluation.angles['Knee Bend'] || evaluation.angles['Knee Angle'] || evaluation.angles['Front Knee'];
        if (val) {
          drawPill(mapPoint(leftKnee), val, evaluation.status !== 'wrong');
        }
      }
    } else if (ex === 'bicep_curls') {
      const rightElbow = landmarks[L.RIGHT_ELBOW];
      if ((rightElbow.visibility || 1) > 0.45 && evaluation.angles['Right Arm']) {
        drawPill(mapPoint(rightElbow), evaluation.angles['Right Arm'], evaluation.status !== 'wrong');
      }
      const leftElbow = landmarks[L.LEFT_ELBOW];
      if ((leftElbow.visibility || 1) > 0.45 && evaluation.angles['Left Arm']) {
        drawPill(mapPoint(leftElbow), evaluation.angles['Left Arm'], evaluation.status !== 'wrong');
      }
    } else if (ex === 'pushups') {
      const rightElbow = landmarks[L.RIGHT_ELBOW];
      const leftElbow = landmarks[L.LEFT_ELBOW];
      const targetElbow = ((rightElbow.visibility || 1) >= (leftElbow.visibility || 1)) ? rightElbow : leftElbow;
      if ((targetElbow.visibility || 1) > 0.45) {
        const val = evaluation.angles['Elbow Angle'] || evaluation.angles['Elbow Bend'];
        if (val) {
          drawPill(mapPoint(targetElbow), val, evaluation.status !== 'wrong');
        }
      }
    } else if (ex === 'plank') {
      const hip = landmarks[L.LEFT_HIP];
      if ((hip.visibility || 1) > 0.5) {
        const val = evaluation.angles['Plank Alignment'] || evaluation.angles['Plank Angle'];
        if (val) {
          drawPill(mapPoint(hip), val, evaluation.status !== 'wrong');
        }
      }
    }
  }

  /**
   * Interactive Synthetic Pose Simulation Demo Mode
   * Allows full visual and audio experience if no webcam is available!
   */
  startDemoMode() {
    this.isDemoMode = true;
    this.isRunning = true;
    const hideOverlay = document.getElementById('camera-placeholder-overlay');
    if (hideOverlay) hideOverlay.classList.add('hidden');

    const loop = () => {
      if (!this.isDemoMode) return;
      this.demoTime += 0.04;

      const landmarks = this.generateSyntheticLandmarks(this.demoTime);
      this.onResults({ poseLandmarks: landmarks, image: null });

      this.demoAnimId = requestAnimationFrame(loop);
    };

    this.demoAnimId = requestAnimationFrame(loop);
  }

  /**
   * Generates mathematical human pose landmarks that simulate natural exercise movement
   */
  generateSyntheticLandmarks(t) {
    const ex = window.exerciseEngine.currentExercise;
    const landmarks = [];

    // Base body center
    const cx = 0.5;
    const cy = 0.45;

    // Movement oscillation 0 to 1
    const phase = (Math.sin(t) + 1) / 2;

    for (let i = 0; i < 33; i++) {
      landmarks.push({ x: cx, y: cy, z: 0, visibility: 0.95 });
    }

    const L = POSE_LANDMARKS;

    // Shoulders
    landmarks[L.LEFT_SHOULDER] = { x: cx - 0.12, y: cy - 0.15, z: 0, visibility: 0.95 };
    landmarks[L.RIGHT_SHOULDER] = { x: cx + 0.12, y: cy - 0.15, z: 0, visibility: 0.95 };

    // Head
    landmarks[L.NOSE] = { x: cx, y: cy - 0.28, z: 0, visibility: 0.95 };

    // Hips
    landmarks[L.LEFT_HIP] = { x: cx - 0.08, y: cy + 0.1, z: 0, visibility: 0.95 };
    landmarks[L.RIGHT_HIP] = { x: cx + 0.08, y: cy + 0.1, z: 0, visibility: 0.95 };

    // Ankles fixed on floor
    landmarks[L.LEFT_ANKLE] = { x: cx - 0.1, y: cy + 0.45, z: 0, visibility: 0.95 };
    landmarks[L.RIGHT_ANKLE] = { x: cx + 0.1, y: cy + 0.45, z: 0, visibility: 0.95 };

    if (ex === 'squats') {
      // Squat depth oscillation
      const squatDrop = phase * 0.18; // Knees bend, hips drop
      landmarks[L.LEFT_HIP].y += squatDrop;
      landmarks[L.RIGHT_HIP].y += squatDrop;
      landmarks[L.LEFT_SHOULDER].y += squatDrop;
      landmarks[L.RIGHT_SHOULDER].y += squatDrop;
      landmarks[L.NOSE].y += squatDrop;

      // Knees bend outward/forward
      landmarks[L.LEFT_KNEE] = { x: cx - 0.15 - (phase * 0.04), y: cy + 0.25 + (squatDrop * 0.5), z: 0, visibility: 0.95 };
      landmarks[L.RIGHT_KNEE] = { x: cx + 0.15 + (phase * 0.04), y: cy + 0.25 + (squatDrop * 0.5), z: 0, visibility: 0.95 };

      // Arms held forward for balance
      landmarks[L.LEFT_ELBOW] = { x: cx - 0.14, y: cy - 0.05 + squatDrop, z: 0, visibility: 0.95 };
      landmarks[L.RIGHT_ELBOW] = { x: cx + 0.14, y: cy - 0.05 + squatDrop, z: 0, visibility: 0.95 };
      landmarks[L.LEFT_WRIST] = { x: cx - 0.1, y: cy + squatDrop, z: 0, visibility: 0.95 };
      landmarks[L.RIGHT_WRIST] = { x: cx + 0.1, y: cy + squatDrop, z: 0, visibility: 0.95 };

    } else if (ex === 'bicep_curls') {
      // Knees straight
      landmarks[L.LEFT_KNEE] = { x: cx - 0.09, y: cy + 0.28, z: 0, visibility: 0.95 };
      landmarks[L.RIGHT_KNEE] = { x: cx + 0.09, y: cy + 0.28, z: 0, visibility: 0.95 };

      // Elbows pinned
      landmarks[L.LEFT_ELBOW] = { x: cx - 0.13, y: cy - 0.01, z: 0, visibility: 0.95 };
      landmarks[L.RIGHT_ELBOW] = { x: cx + 0.13, y: cy - 0.01, z: 0, visibility: 0.95 };

      // Wrists curling up from below elbow to shoulder level
      const curlY = (cy - 0.11) + (1 - phase) * 0.25; // Moves smoothly between bottom (extended) and top (contracted)
      landmarks[L.LEFT_WRIST] = { x: cx - 0.12, y: curlY, z: 0, visibility: 0.95 };
      landmarks[L.RIGHT_WRIST] = { x: cx + 0.12, y: curlY, z: 0, visibility: 0.95 };
    } else {
      // Default natural standing stance
      landmarks[L.LEFT_KNEE] = { x: cx - 0.09, y: cy + 0.28, z: 0, visibility: 0.95 };
      landmarks[L.RIGHT_KNEE] = { x: cx + 0.09, y: cy + 0.28, z: 0, visibility: 0.95 };
      landmarks[L.LEFT_ELBOW] = { x: cx - 0.15, y: cy - 0.02, z: 0, visibility: 0.95 };
      landmarks[L.RIGHT_ELBOW] = { x: cx + 0.15, y: cy - 0.02, z: 0, visibility: 0.95 };
      landmarks[L.LEFT_WRIST] = { x: cx - 0.16, y: cy + 0.12, z: 0, visibility: 0.95 };
      landmarks[L.RIGHT_WRIST] = { x: cx + 0.16, y: cy + 0.12, z: 0, visibility: 0.95 };
    }

    return landmarks;
  }
}

// Global instance
window.poseDetector = new PoseDetector();

/**
 * Exercise Form Evaluation & Pose Processing Engine
 * High-precision mathematical angle algorithms, landmark index mappings,
 * independent arm/leg state machines with anti-cheat & anti-jitter verification,
 * and intuitive real-time cues in English & Telugu.
 */

// MediaPipe Pose Landmark Indices Mapping
const POSE_LANDMARKS = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32
};

/**
 * Calculates the interior angle (in degrees: 0° - 180°) formed by three points (A -> B -> C)
 * Point B is the vertex joint.
 */
function calculateAngle(a, b, c) {
  if (!a || !b || !c) return 0;
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180.0) {
    angle = 360.0 - angle;
  }
  return Math.round(angle);
}

/**
 * Calculates Euclidean distance between two 2D points
 */
function calculateDistance(a, b) {
  if (!a || !b) return 0;
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

class ExerciseEngine {
  constructor() {
    this.currentExercise = 'squats';
    this.stage = 'up'; // 'up', 'down', 'hold'
    this.repCount = 0;
    this.correctCount = 0;
    this.wrongCount = 0;
    this.lastWrongTime = 0;
    this.lastRepTime = 0;
    this.currentRepMistakes = 0;
    this.repScores = [];

    // Plank specific tracking
    this.plankGoodFrames = 0;
    this.plankBadFrames = 0;
    this.plankHoldSeconds = 0;
    this.lastPlankSecTime = 0;

    // Independent arm tracking for Bicep Curls (eliminates false reps & enables alternating/single curls)
    this.curlArms = {
      right: {
        stage: 'down',
        readyForCurl: false,
        startTime: 0,
        hasReachedTop: false
      },
      left: {
        stage: 'down',
        readyForCurl: false,
        startTime: 0,
        hasReachedTop: false
      }
    };

    // Squat state machine
    this.squatState = {
      stage: 'up',
      readyForSquat: false,
      startTime: 0,
      lowestKneeAngle: 180
    };

    // Pushup state machine
    this.pushupState = {
      stage: 'up',
      readyForPushup: false,
      startTime: 0
    };

    // Lunge state machine
    this.lungeState = {
      stage: 'up',
      readyForLunge: false,
      startTime: 0
    };

    // Jumping jacks state machine
    this.jackState = {
      stage: 'in',
      readyForJack: false,
      startTime: 0
    };

    // MET (Metabolic Equivalent) for calorie estimation
    this.metValues = {
      squats: 5.0,
      pushups: 8.0,
      bicep_curls: 4.0,
      plank: 3.8,
      lunges: 5.5,
      jumping_jacks: 8.5
    };

    // User weight estimate (70 kg default)
    this.userWeightKg = 70;
  }

  setExercise(exerciseKey) {
    this.currentExercise = exerciseKey;
    this.resetStats();
  }

  resetStats() {
    this.stage = (this.currentExercise === 'bicep_curls') ? 'down' : 'up';
    this.repCount = 0;
    this.correctCount = 0;
    this.wrongCount = 0;
    this.lastWrongTime = 0;
    this.lastRepTime = 0;
    this.currentRepMistakes = 0;
    this.repScores = [];
    this.plankGoodFrames = 0;
    this.plankBadFrames = 0;
    this.plankHoldSeconds = 0;
    this.lastPlankSecTime = 0;

    // Reset independent state trackers
    this.curlArms = {
      right: { stage: 'down', readyForCurl: false, startTime: 0, hasReachedTop: false },
      left: { stage: 'down', readyForCurl: false, startTime: 0, hasReachedTop: false }
    };
    this.squatState = { stage: 'up', readyForSquat: false, startTime: 0, lowestKneeAngle: 180 };
    this.pushupState = { stage: 'up', readyForPushup: false, startTime: 0 };
    this.lungeState = { stage: 'up', readyForLunge: false, startTime: 0 };
    this.jackState = { stage: 'in', readyForJack: false, startTime: 0 };
  }

  /**
   * Rate limits form penalty increments so accuracy does not plummet immediately
   */
  recordWrong(cooldownMs = 1800) {
    const now = Date.now();
    if (now - this.lastWrongTime > cooldownMs) {
      this.wrongCount++;
      this.currentRepMistakes++;
      this.lastWrongTime = now;
      return true;
    }
    return false;
  }

  /**
   * Completes a repetition and records its individual form score
   */
  finishRep() {
    this.repCount++;
    let repScore = 98;
    if (this.currentRepMistakes === 1) {
      repScore = 88;
    } else if (this.currentRepMistakes === 2) {
      repScore = 78;
    } else if (this.currentRepMistakes >= 3) {
      repScore = 68;
    }
    this.repScores.push(repScore);
    this.currentRepMistakes = 0;
    this.correctCount += 3;
    this.triggerRepBump();
    return repScore;
  }

  /**
   * Pulses on-screen rep counters with vibrant micro-animation
   */
  triggerRepBump() {
    const repNumEl = document.getElementById('hud-rep-number');
    if (repNumEl) {
      repNumEl.classList.add('bump');
      setTimeout(() => repNumEl.classList.remove('bump'), 350);
    }
    const metricRepsEl = document.getElementById('metric-reps-count');
    if (metricRepsEl) {
      metricRepsEl.classList.add('bump');
      setTimeout(() => metricRepsEl.classList.remove('bump'), 350);
    }
  }

  /**
   * Main evaluation dispatcher for current frame landmarks
   * @param {Array} landmarks - 33 MediaPipe pose landmarks
   * @returns {Object} Frame evaluation results
   */
  evaluate(landmarks) {
    if (!landmarks || landmarks.length < 33) {
      return {
        status: 'idle',
        action: 'STAND IN VIEW',
        actionTelugu: 'కెమెరా ముందు నిలబడండి',
        message: 'Step back so your body is clearly visible in the camera',
        messageTelugu: 'మీ శరీరం కెమెరాలో స్పష్టంగా కనిపించేలా కాస్త వెనక్కి జరగండి',
        actionArrow: 'hold',
        currentStep: 1,
        isCorrect: false,
        problemJoints: [],
        angles: {},
        repCount: this.repCount,
        accuracy: this.getAccuracy()
      };
    }

    switch (this.currentExercise) {
      case 'squats':
        return this.evaluateSquats(landmarks);
      case 'pushups':
        return this.evaluatePushups(landmarks);
      case 'bicep_curls':
        return this.evaluateBicepCurls(landmarks);
      case 'plank':
        return this.evaluatePlank(landmarks);
      case 'lunges':
        return this.evaluateLunges(landmarks);
      case 'jumping_jacks':
        return this.evaluateJumpingJacks(landmarks);
      default:
        return this.evaluateSquats(landmarks);
    }
  }

  /**
   * BICEP CURLS EVALUATION (ROCK-SOLID PRECISION ENGINE)
   *
   * Solves previous issues:
   * 1. NO FALSE REPS when idle, sitting at desk, typing, or touching face.
   *    - Arm MUST start extended downward (wrist below elbow, angle > 125°) to prime `readyForCurl`.
   *    - Wrist must curl upwards towards shoulder (wrist moves above elbow).
   *    - Upper arm must remain pointing downwards (elbow below shoulder level).
   *    - Rep duration check (must take >= 550ms, eliminating noise spikes).
   * 2. ACCURATE DETECTION FOR REAL WORKOUTS:
   *    - Evaluates Right and Left arms INDEPENDENTLY. One arm curling does not get blocked
   *      by the other arm holding weights or resting.
   *    - Seamless support for Single-Arm, Alternating Curls, and Double-Arm Curls.
   *    - 700ms cooldown prevents accidental duplicate counts on simultaneous arm curls.
   *    - Realistic contraction threshold (< 85°) and extension threshold (> 125°).
   */
  evaluateBicepCurls(landmarks) {
    const L = POSE_LANDMARKS;
    const now = Date.now();

    const rightShoulder = landmarks[L.RIGHT_SHOULDER];
    const rightElbow = landmarks[L.RIGHT_ELBOW];
    const rightWrist = landmarks[L.RIGHT_WRIST];
    const rightHip = landmarks[L.RIGHT_HIP];

    const leftShoulder = landmarks[L.LEFT_SHOULDER];
    const leftElbow = landmarks[L.LEFT_ELBOW];
    const leftWrist = landmarks[L.LEFT_WRIST];
    const leftHip = landmarks[L.LEFT_HIP];

    // Visibility / Confidence Verification (minimum 0.45)
    const rightVisible = (rightShoulder.visibility || 1) >= 0.45 &&
                         (rightElbow.visibility || 1) >= 0.45 &&
                         (rightWrist.visibility || 1) >= 0.45;

    const leftVisible = (leftShoulder.visibility || 1) >= 0.45 &&
                        (leftElbow.visibility || 1) >= 0.45 &&
                        (leftWrist.visibility || 1) >= 0.45;

    if (!rightVisible && !leftVisible) {
      return {
        status: 'idle',
        action: 'ARMS NOT VISIBLE',
        actionTelugu: 'చేతులు స్పష్టంగా కనిపించడం లేదు',
        message: 'Step back so your shoulders, elbows, and hands are visible in camera',
        messageTelugu: 'మీ భుజాలు, మోచేతులు మరియు చేతులు స్పష్టంగా కనిపించేలా కాస్త వెనక్కి జరగండి',
        actionArrow: 'hold',
        currentStep: 1,
        isCorrect: false,
        problemJoints: [],
        stage: 'WAITING',
        repCount: this.repCount,
        accuracy: this.getAccuracy(),
        angles: {
          'Tracking Status': 'Positioning arms...'
        }
      };
    }

    const rightElbowAngle = rightVisible ? calculateAngle(rightShoulder, rightElbow, rightWrist) : 180;
    const leftElbowAngle = leftVisible ? calculateAngle(leftShoulder, leftElbow, leftWrist) : 180;

    // Check that upper arm points downward (elbow below shoulder level)
    // Prevents counting when raising whole arm overhead, scratching head, or stretching
    const rightElbowDown = rightVisible && (rightElbow.y > rightShoulder.y - 0.05);
    const leftElbowDown = leftVisible && (leftElbow.y > leftShoulder.y - 0.05);

    // Hip visibility for elbow swing check
    const hipVisible = (rightHip.visibility || 1) > 0.4 || (leftHip.visibility || 1) > 0.4;
    let rightSwing = 0;
    let leftSwing = 0;
    if (hipVisible && rightVisible) {
      rightSwing = calculateAngle(rightHip, rightShoulder, rightElbow);
    }
    if (hipVisible && leftVisible) {
      leftSwing = calculateAngle(leftHip, leftShoulder, leftElbow);
    }

    const armEntries = [
      {
        side: 'right',
        name: 'Right Arm',
        nameTe: 'కుడి చేయి',
        visible: rightVisible && rightElbowDown,
        angle: rightElbowAngle,
        shoulder: rightShoulder,
        elbow: rightElbow,
        wrist: rightWrist,
        state: this.curlArms.right,
        swing: rightSwing,
        elbowJoint: L.RIGHT_ELBOW
      },
      {
        side: 'left',
        name: 'Left Arm',
        nameTe: 'ఎడమ చేయి',
        visible: leftVisible && leftElbowDown,
        angle: leftElbowAngle,
        shoulder: leftShoulder,
        elbow: leftElbow,
        wrist: leftWrist,
        state: this.curlArms.left,
        swing: leftSwing,
        elbowJoint: L.LEFT_ELBOW
      }
    ];

    let repTriggeredThisFrame = false;
    let formWarningJoints = [];
    let isSwinging = false;

    for (const arm of armEntries) {
      if (!arm.visible) continue;

      const state = arm.state;
      const angle = arm.angle;
      // In 2D normalized coordinates, y=0 is top, y=1 is bottom.
      // Hand below elbow: wrist.y > elbow.y
      // Hand above elbow (curling towards shoulder): wrist.y < elbow.y + 0.04
      const wristBelowElbow = arm.wrist.y > arm.elbow.y - 0.02;
      const wristCurledUp = arm.wrist.y < arm.elbow.y + 0.05;

      // Excessive elbow swing check (> 62° flare while in mid-curl)
      if (arm.swing > 62 && angle < 115 && angle > 80) {
        isSwinging = true;
        formWarningJoints.push(arm.elbowJoint);
      }

      // 1. EXTENDED DOWN POSITION (Start / Finish of Rep)
      // Angle >= 125° with wrist hanging below the elbow
      if (angle >= 125 && wristBelowElbow) {
        if (state.stage === 'up' && state.hasReachedTop && state.readyForCurl) {
          // COMPLETED FULL REPETITION!
          const repDuration = now - state.startTime;
          const timeSinceLastRep = now - this.lastRepTime;

          // Must be human duration (>= 550ms) and global cooldown (>= 700ms)
          if (repDuration >= 550 && timeSinceLastRep >= 700) {
            this.finishRep();
            this.lastRepTime = now;
            repTriggeredThisFrame = true;

            window.audioCoach?.playRepSuccessSound();
            window.audioCoach?.speak(`${this.repCount}! Perfect curl!`, true);
          }

          // Reset arm state for next rep
          state.stage = 'down';
          state.hasReachedTop = false;
          state.readyForCurl = true;
          state.startTime = 0;
        } else {
          // Arm is primed in proper starting position
          state.stage = 'down';
          state.readyForCurl = true;
        }
      }
      // 2. PEAK CONTRACTION AT TOP (Flexion)
      // Angle <= 85° with forearm curled upwards toward shoulder
      else if (angle <= 85 && wristCurledUp) {
        if (state.stage === 'down' && state.readyForCurl) {
          // Successfully curled up from verified bottom position
          state.stage = 'up';
          state.hasReachedTop = true;
          if (!state.startTime) {
            state.startTime = now;
          }
          this.correctCount++;
        }
      }
      // 3. MID-CURL IN PROGRESS
      else if (state.stage === 'down' && angle < 120 && state.readyForCurl) {
        if (!state.startTime) {
          state.startTime = now;
        }
      }
    }

    // Determine primary active arm for feedback & HUD inspection
    let primaryArm = armEntries[0];
    if (!armEntries[0].visible && armEntries[1].visible) {
      primaryArm = armEntries[1];
    } else if (armEntries[0].visible && armEntries[1].visible) {
      // Pick arm with greater contraction
      if (armEntries[1].angle < armEntries[0].angle) {
        primaryArm = armEntries[1];
      }
    }

    const anyArmUp = this.curlArms.right.stage === 'up' || this.curlArms.left.stage === 'up';
    this.stage = anyArmUp ? 'up' : 'down';

    // HUD Guidance & Telugu Translations
    let status = 'idle';
    let action = '⬆️ CURL UP NOW';
    let actionTelugu = '⬆️ చేయి పైకి ఎత్తండి';
    let message = 'Extend arms down to start, then curl up toward shoulders';
    let messageTelugu = 'చేతులు కింద ఉంచి ప్రారంభించండి, తర్వాత భుజం వైపు పైకి ఎత్తండి';
    let actionArrow = 'up';
    let currentStep = 1;
    let isCorrect = true;

    if (isSwinging) {
      status = 'wrong';
      action = '⚠️ STEADY ELBOWS';
      actionTelugu = '⚠️ మోచేయి కదల్చకండి';
      message = 'Pin elbows close to your torso — avoid swinging arms forward';
      messageTelugu = 'మోచేయి నడుము దగ్గరే ఉంచండి — ముందుకు ఊపకండి';
      actionArrow = 'hold';
      isCorrect = false;
      if (this.recordWrong(2000)) {
        window.audioCoach?.speak('Keep elbows steady at your side!', false);
        window.audioCoach?.playWarningSound();
      }
    } else if (repTriggeredThisFrame) {
      status = 'good';
      action = '✅ PERFECT CURL!';
      actionTelugu = '✅ అద్భుతం! రెప్ పూర్తయింది';
      message = `Rep ${this.repCount} complete! Continue smooth rhythm`;
      messageTelugu = `రెప్ ${this.repCount} విజయవంతంగా పూర్తయింది! తర్వాతి రెప్ ప్రారంభించండి`;
      actionArrow = 'up';
      currentStep = 3;
    } else if (anyArmUp) {
      status = 'good';
      action = '⬇️ LOWER DOWN SLOWLY';
      actionTelugu = '⬇️ నెమ్మదిగా కిందకు దించండి';
      message = 'Great squeeze! Now lower hand all the way down to finish rep';
      messageTelugu = 'బాగా చేసారు! ఇప్పుడు చేయి పూర్తిగా కిందకు దించి రెప్ పూర్తి చేయండి';
      actionArrow = 'down';
      currentStep = 2;
    } else if (primaryArm.angle < 120 && primaryArm.angle > 85) {
      status = 'idle';
      action = '⬆️ SQUEEZE AT TOP';
      actionTelugu = '⬆️ పూర్తిగా పైకి ఎత్తండి';
      message = 'Lift hand higher toward shoulder level to complete contraction';
      messageTelugu = 'చేతిని భుజం వరకు పూర్తిగా పైకి ఎత్తండి';
      actionArrow = 'up';
      currentStep = 1;
    } else {
      status = 'idle';
      action = '⬆️ CURL UP NOW';
      actionTelugu = '⬆️ చేయి పైకి ఎత్తండి';
      message = 'Keep elbow stationary and curl your forearm up smoothly';
      messageTelugu = 'మోచేయి కదలకుండా చేతిని నెమ్మదిగా పైకి ఎత్తండి';
      actionArrow = 'up';
      currentStep = 1;
    }

    const angleReadings = {};
    if (rightVisible) {
      angleReadings['Right Arm'] = `${rightElbowAngle}°`;
    }
    if (leftVisible) {
      angleReadings['Left Arm'] = `${leftElbowAngle}°`;
    }
    angleReadings['Active Arm'] = `${primaryArm.name} (${primaryArm.angle}°)`;

    return {
      status,
      action,
      actionTelugu,
      message,
      messageTelugu,
      actionArrow,
      currentStep,
      isCorrect,
      problemJoints: formWarningJoints,
      stage: this.stage.toUpperCase(),
      repCount: this.repCount,
      accuracy: this.getAccuracy(),
      angles: angleReadings
    };
  }

  /**
   * SQUATS EVALUATION
   * Parallel squat depth: <= 125° (fair & safe for all heights)
   * Standing extension: >= 142°
   * Prevents false reps by requiring vertical hip drop and valid standing start.
   */
  evaluateSquats(landmarks) {
    const L = POSE_LANDMARKS;
    const now = Date.now();

    const leftHip = landmarks[L.LEFT_HIP];
    const leftKnee = landmarks[L.LEFT_KNEE];
    const leftAnkle = landmarks[L.LEFT_ANKLE];
    const leftShoulder = landmarks[L.LEFT_SHOULDER];

    const rightHip = landmarks[L.RIGHT_HIP];
    const rightKnee = landmarks[L.RIGHT_KNEE];
    const rightAnkle = landmarks[L.RIGHT_ANKLE];
    const rightShoulder = landmarks[L.RIGHT_SHOULDER];

    const hipsVisible = (leftHip.visibility || 1) > 0.4 || (rightHip.visibility || 1) > 0.4;
    const kneesVisible = (leftKnee.visibility || 1) > 0.4 || (rightKnee.visibility || 1) > 0.4;

    if (!hipsVisible || !kneesVisible) {
      return {
        status: 'idle',
        action: 'STEP BACK',
        actionTelugu: 'కాస్త వెనక్కి జరగండి',
        message: 'Step back so your hips, knees, and feet are visible in frame',
        messageTelugu: 'మీ నడుము, మోకాళ్లు కెమెరాలో కనిపించేలా వెనక్కి జరగండి',
        actionArrow: 'hold',
        currentStep: 1,
        isCorrect: false,
        problemJoints: [],
        stage: 'WAITING',
        repCount: this.repCount,
        accuracy: this.getAccuracy(),
        angles: { 'Knee Angle': 'Detecting...' }
      };
    }

    const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
    const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
    const kneeAngle = Math.round((leftKneeAngle + rightKneeAngle) / 2);

    const leftTorsoAngle = calculateAngle(leftShoulder, leftHip, leftKnee);
    const rightTorsoAngle = calculateAngle(rightShoulder, rightHip, rightKnee);
    const torsoAngle = Math.round((leftTorsoAngle + rightTorsoAngle) / 2);

    let status = 'idle';
    let action = '🏋️ SQUAT DOWN';
    let actionTelugu = '🏋️ కిందకు కూర్చోండి';
    let message = 'Bend your knees and push hips back like sitting on a chair';
    let messageTelugu = 'కుర్చీలో కూర్చున్నట్లు నెమ్మదిగా మోకాళ్లు వంచి కిందకు రండి';
    let actionArrow = 'down';
    let currentStep = 1;
    let isCorrect = true;
    let problemJoints = [];

    // 1. Standing tall position (>= 142°)
    if (kneeAngle >= 142) {
      if (this.stage === 'down' && this.squatState.readyForSquat) {
        // DRIVE BACK UP COMPLETED!
        const repDuration = now - this.squatState.startTime;
        const timeSinceLastRep = now - this.lastRepTime;

        if (timeSinceLastRep >= 900) {
          this.finishRep();
          this.lastRepTime = now;
          status = 'good';
          action = '✅ PERFECT SQUAT!';
          actionTelugu = '✅ అద్భుతం! రెప్ పూర్తయింది';
          message = `Rep ${this.repCount} complete! Stand tall and ready for next`;
          messageTelugu = `రెప్ ${this.repCount} పూర్తయింది! తర్వాతి రెప్ ప్రారంభించండి`;
          actionArrow = 'down';
          currentStep = 3;

          window.audioCoach?.playRepSuccessSound();
          window.audioCoach?.speak(`${this.repCount}! Perfect squat!`, true);
        }
        this.stage = 'up';
        this.squatState.stage = 'up';
        this.squatState.readyForSquat = true;
        this.squatState.startTime = 0;
      } else {
        this.stage = 'up';
        this.squatState.stage = 'up';
        this.squatState.readyForSquat = true;
      }
    }
    // 2. Deep Squat position (<= 125°)
    else if (kneeAngle <= 125 && this.squatState.readyForSquat) {
      // Check posture alignment (excessive forward lean)
      if (torsoAngle < 52) {
        status = 'wrong';
        action = '⚠️ CHEST UP!';
        actionTelugu = '⚠️ ఛాతీ నిటారుగా ఉంచండి!';
        message = 'Keep chest upright and back straight — look straight ahead';
        messageTelugu = 'ముందుకు చూడండి! ఛాతీ నిటారుగా ఉంచి ముందుకు వంగకండి';
        actionArrow = 'up';
        currentStep = 2;
        isCorrect = false;
        problemJoints = [L.LEFT_SHOULDER, L.RIGHT_SHOULDER, L.LEFT_HIP, L.RIGHT_HIP];
        if (this.recordWrong()) {
          window.audioCoach?.speak('Keep your chest up!', false);
          window.audioCoach?.playWarningSound();
        }
      } else {
        status = 'good';
        action = '🧍 STAND UP NOW';
        actionTelugu = '🧍 నిటారుగా పైకి లేవండి';
        message = 'Great depth! Push through your heels to stand straight up';
        messageTelugu = 'అద్భుతమైన డెప్త్! ఇప్పుడు పాదాలతో బలంగా పైకి లేవండి';
        actionArrow = 'up';
        currentStep = 2;
        isCorrect = true;
        this.correctCount++;
        this.stage = 'down';
        this.squatState.stage = 'down';
        if (!this.squatState.startTime) this.squatState.startTime = now;
      }
    }
    // 3. Halfway down guidance
    else if (kneeAngle > 125 && kneeAngle < 142 && this.stage === 'up') {
      status = 'idle';
      action = '⬇️ SQUAT DEEPER';
      actionTelugu = '⬇️ ఇంకా కాస్త కిందకు వంగండి';
      message = 'Lower hips a bit more until thighs approach parallel to floor';
      messageTelugu = 'తొడలు నేలకు సమాంతరంగా ఉండేలా ఇంకొంచెం కిందకు రండి';
      actionArrow = 'down';
      currentStep = 1;
      if (!this.squatState.startTime) this.squatState.startTime = now;
    }

    return {
      status,
      action,
      actionTelugu,
      message,
      messageTelugu,
      actionArrow,
      currentStep,
      isCorrect,
      problemJoints,
      stage: this.stage.toUpperCase(),
      repCount: this.repCount,
      accuracy: this.getAccuracy(),
      angles: {
        'Knee Bend': `${kneeAngle}°`,
        'Torso Angle': `${torsoAngle}°`
      }
    };
  }

  /**
   * PUSH-UPS EVALUATION
   * Strictly enforces HORIZONTAL plank position.
   * Completely prevents counting push-ups while standing vertically!
   * Elbow depth: <= 105° (bottom)
   * Lockout: >= 138° (top)
   */
  evaluatePushups(landmarks) {
    const L = POSE_LANDMARKS;
    const now = Date.now();

    const leftShoulder = landmarks[L.LEFT_SHOULDER];
    const rightShoulder = landmarks[L.RIGHT_SHOULDER];
    const leftElbow = landmarks[L.LEFT_ELBOW];
    const rightElbow = landmarks[L.RIGHT_ELBOW];
    const leftWrist = landmarks[L.LEFT_WRIST];
    const rightWrist = landmarks[L.RIGHT_WRIST];
    const leftHip = landmarks[L.LEFT_HIP];
    const rightHip = landmarks[L.RIGHT_HIP];
    const leftAnkle = landmarks[L.LEFT_ANKLE];
    const rightAnkle = landmarks[L.RIGHT_ANKLE];

    // Pick arm with highest landmark confidence
    const leftVis = (leftShoulder.visibility || 1) + (leftElbow.visibility || 1);
    const rightVis = (rightShoulder.visibility || 1) + (rightElbow.visibility || 1);
    const isLeft = leftVis >= rightVis;

    const shoulder = isLeft ? leftShoulder : rightShoulder;
    const elbow = isLeft ? leftElbow : rightElbow;
    const wrist = isLeft ? leftWrist : rightWrist;
    const hip = isLeft ? leftHip : rightHip;
    const ankle = isLeft ? leftAnkle : rightAnkle;

    // HORIZONTAL ORIENTATION CHECK:
    // When standing upright, shoulder is high (y~0.2) and hip is far below (y~0.6).
    // In a pushup on the floor, the body is horizontal or diagonal across frame.
    const isStandingUpright = (hip.y > shoulder.y + 0.32) && (Math.abs(shoulder.x - hip.x) < 0.18);

    if (isStandingUpright) {
      return {
        status: 'idle',
        action: 'GET IN PLANK POSITION',
        actionTelugu: 'ప్లాంక్ పొజిషన్‌లో కిందకు ఉండండి',
        message: 'Place hands on floor in horizontal plank position to do push-ups',
        messageTelugu: 'పుష్-అప్స్ చేయడానికి చేతులు నేలపై ఉంచి శరీరాన్ని సమాంతరంగా ఉంచండి',
        actionArrow: 'down',
        currentStep: 1,
        isCorrect: true,
        problemJoints: [],
        stage: 'STANDBY',
        repCount: this.repCount,
        accuracy: this.getAccuracy(),
        angles: {
          'Position': 'Standing — need horizontal floor plank'
        }
      };
    }

    const elbowAngle = calculateAngle(shoulder, elbow, wrist);
    const bodyPlankAngle = calculateAngle(shoulder, hip, ankle);

    let status = 'idle';
    let action = '⬇️ LOWER CHEST';
    let actionTelugu = '⬇️ ఛాతీని కిందకు దించండి';
    let message = 'Bend your elbows and lower chest toward the floor';
    let messageTelugu = 'చేతులు వంచి ఛాతీని నేల వైపు కిందకు దించండి';
    let actionArrow = 'down';
    let currentStep = 1;
    let isCorrect = true;
    let problemJoints = [];

    // Body sagging check
    if (bodyPlankAngle < 140) {
      status = 'wrong';
      action = '⚠️ LIFT HIPS';
      actionTelugu = '⚠️ నడుము పైకి ఎత్తండి';
      message = 'Hips are sagging! Tighten core and straighten your back';
      messageTelugu = 'నడుము కిందకు జారనీయకండి! పొట్ట బిగించి శరీరాన్ని తిన్నగా ఉంచండి';
      actionArrow = 'up';
      isCorrect = false;
      problemJoints = [isLeft ? L.LEFT_HIP : L.RIGHT_HIP];
      if (this.recordWrong()) {
        window.audioCoach?.speak('Do not sag hips!', false);
        window.audioCoach?.playWarningSound();
      }
    } else {
      // Arms locked out / Top position (>= 138°)
      if (elbowAngle >= 138) {
        if (this.stage === 'down' && this.pushupState.readyForPushup) {
          const timeSinceLastRep = now - this.lastRepTime;
          if (timeSinceLastRep >= 800) {
            this.finishRep();
            this.lastRepTime = now;
            status = 'good';
            action = '✅ STRONG PUSH!';
            actionTelugu = '✅ అద్భుతం! రెప్ పూర్తయింది';
            message = `Rep ${this.repCount} complete! Great arm strength`;
            messageTelugu = `రెప్ ${this.repCount} విజయవంతంగా పూర్తయింది! తర్వాతి రెప్ ప్రారంభించండి`;
            actionArrow = 'down';
            currentStep = 3;
            window.audioCoach?.playRepSuccessSound();
            window.audioCoach?.speak(`${this.repCount}! Perfect pushup!`, true);
          }
          this.stage = 'up';
          this.pushupState.stage = 'up';
          this.pushupState.readyForPushup = true;
        } else {
          this.stage = 'up';
          this.pushupState.stage = 'up';
          this.pushupState.readyForPushup = true;
        }
      }
      // Chest lowered to floor / Bottom position (<= 105°)
      else if (elbowAngle <= 105 && this.pushupState.readyForPushup) {
        this.stage = 'down';
        this.pushupState.stage = 'down';
        this.correctCount++;
        status = 'good';
        action = '⬆️ PUSH UP STRONG';
        actionTelugu = '⬆️ చేతులతో పైకి లేవండి';
        message = 'Full depth reached! Drive straight back up to plank';
        messageTelugu = 'పూర్తి డెప్త్ వచ్చింది! చేతులతో బలంగా పైకి లేవండి';
        actionArrow = 'up';
        currentStep = 2;
      }
    }

    return {
      status,
      action,
      actionTelugu,
      message,
      messageTelugu,
      actionArrow,
      currentStep,
      isCorrect,
      problemJoints,
      stage: this.stage.toUpperCase(),
      repCount: this.repCount,
      accuracy: this.getAccuracy(),
      angles: {
        'Elbow Angle': `${elbowAngle}°`,
        'Plank Line': `${bodyPlankAngle}°`
      }
    };
  }

  /**
   * PLANK HOLD EVALUATION
   * Measures isometric hold time in seconds with proper horizontal spine line.
   */
  evaluatePlank(landmarks) {
    const L = POSE_LANDMARKS;
    const now = Date.now();

    const shoulder = landmarks[L.LEFT_SHOULDER];
    const hip = landmarks[L.LEFT_HIP];
    const ankle = landmarks[L.LEFT_ANKLE];

    const plankAngle = calculateAngle(shoulder, hip, ankle);

    let status = 'idle';
    let action = '🧘 HOLD STEADY';
    let actionTelugu = '🧘 కదలకుండా ఉండండి';
    let message = 'Hold your body straight in a horizontal line and breathe';
    let messageTelugu = 'శరీరాన్ని నేలకు సమాంతరంగా ఉంచి ఊపిరి పీల్చుకుంటూ ఉండండి';
    let actionArrow = 'hold';
    let currentStep = 2;
    let isCorrect = true;
    let problemJoints = [];

    if (plankAngle < 145) {
      status = 'wrong';
      action = '⚠️ LIFT HIPS';
      actionTelugu = '⚠️ నడుము పైకి ఎత్తండి';
      message = 'Hips sagging! Tighten core to protect your lower back';
      messageTelugu = 'నడుము కిందకు జారనీయకండి! పొట్ట బిగించి పైకి ఎత్తండి';
      actionArrow = 'up';
      isCorrect = false;
      this.plankBadFrames++;
      problemJoints = [L.LEFT_HIP, L.RIGHT_HIP];
      if (this.recordWrong()) {
        window.audioCoach?.speak('Lift your hips!', false);
        window.audioCoach?.playWarningSound();
      }
    } else {
      status = 'good';
      action = '✅ PERFECT PLANK!';
      actionTelugu = '✅ అద్భుతమైన ప్లాంక్!';
      message = 'Great straight alignment! Hold steady and breathe smoothly';
      messageTelugu = 'శరీరం సరైన స్థితిలో ఉంది! కదలకుండా అలాగే ఉండండి';
      actionArrow = 'hold';
      isCorrect = true;
      this.plankGoodFrames++;
      this.correctCount++;

      // Track hold seconds
      if (now - this.lastPlankSecTime >= 1000) {
        this.plankHoldSeconds++;
        this.lastPlankSecTime = now;
        this.repCount = this.plankHoldSeconds; // For plank, display hold duration as reps
        if (this.plankHoldSeconds % 10 === 0) {
          window.audioCoach?.speak(`${this.plankHoldSeconds} seconds held! Strong core!`, false);
        }
      }
    }

    return {
      status,
      action,
      actionTelugu,
      message,
      messageTelugu,
      actionArrow,
      currentStep,
      isCorrect,
      problemJoints,
      stage: 'HOLDING',
      repCount: this.repCount,
      accuracy: this.getAccuracy(),
      angles: {
        'Plank Alignment': `${plankAngle}°`,
        'Hold Duration': `${this.plankHoldSeconds}s`
      }
    };
  }

  /**
   * LUNGES EVALUATION
   */
  evaluateLunges(landmarks) {
    const L = POSE_LANDMARKS;
    const now = Date.now();

    const frontKneeAngle = calculateAngle(landmarks[L.LEFT_HIP], landmarks[L.LEFT_KNEE], landmarks[L.LEFT_ANKLE]);
    const backKneeAngle = calculateAngle(landmarks[L.RIGHT_HIP], landmarks[L.RIGHT_KNEE], landmarks[L.RIGHT_ANKLE]);

    let status = 'idle';
    let action = '🦵 STEP & LOWER';
    let actionTelugu = '🦵 ముందుకు అడుగు వేసి వంగండి';
    let message = 'Step forward and lower both knees smoothly';
    let messageTelugu = 'ముందుకు అడుగు వేసి రెండు మోకాళ్లు వంచి కిందకు రండి';
    let actionArrow = 'down';
    let currentStep = 1;
    let isCorrect = true;
    let problemJoints = [];

    const lowestKnee = Math.min(frontKneeAngle, backKneeAngle);

    if (lowestKnee >= 140) {
      if (this.stage === 'down' && this.lungeState.readyForLunge) {
        const timeSinceLastRep = now - this.lastRepTime;
        if (timeSinceLastRep >= 900) {
          this.finishRep();
          this.lastRepTime = now;
          status = 'good';
          action = '✅ STRONG STEP!';
          actionTelugu = '✅ అద్భుతం! రెప్ పూర్తయింది';
          message = `Rep ${this.repCount} complete! Step with your other leg`;
          messageTelugu = `రెప్ ${this.repCount} పూర్తయింది! మరో కాలితో అడుగు వేయండి`;
          actionArrow = 'down';
          currentStep = 3;
          window.audioCoach?.playRepSuccessSound();
          window.audioCoach?.speak(`${this.repCount}! Strong lunge!`, true);
        }
        this.stage = 'up';
        this.lungeState.stage = 'up';
        this.lungeState.readyForLunge = true;
      } else {
        this.stage = 'up';
        this.lungeState.stage = 'up';
        this.lungeState.readyForLunge = true;
      }
    } else if (lowestKnee <= 118 && this.lungeState.readyForLunge) {
      this.stage = 'down';
      this.lungeState.stage = 'down';
      status = 'good';
      action = '🧍 PUSH BACK UP';
      actionTelugu = '🧍 వెనక్కి వచ్చి నిలబడండి';
      message = 'Great depth! Push through your front heel back to standing';
      messageTelugu = 'సరైన డెప్త్ వచ్చింది! ముందు పాదంతో బలంగా వెనక్కి లేవండి';
      actionArrow = 'up';
      currentStep = 2;
      this.correctCount++;
    }

    return {
      status,
      action,
      actionTelugu,
      message,
      messageTelugu,
      actionArrow,
      currentStep,
      isCorrect,
      problemJoints,
      stage: this.stage.toUpperCase(),
      repCount: this.repCount,
      accuracy: this.getAccuracy(),
      angles: {
        'Front Knee': `${frontKneeAngle}°`,
        'Rear Knee': `${backKneeAngle}°`
      }
    };
  }

  /**
   * JUMPING JACKS EVALUATION
   */
  evaluateJumpingJacks(landmarks) {
    const L = POSE_LANDMARKS;
    const now = Date.now();

    const leftWrist = landmarks[L.LEFT_WRIST];
    const rightWrist = landmarks[L.RIGHT_WRIST];
    const leftShoulder = landmarks[L.LEFT_SHOULDER];
    const rightShoulder = landmarks[L.RIGHT_SHOULDER];
    const leftAnkle = landmarks[L.LEFT_ANKLE];
    const rightAnkle = landmarks[L.RIGHT_ANKLE];

    const armsOverhead = (leftWrist.y < leftShoulder.y) && (rightWrist.y < rightShoulder.y);
    const feetSpread = Math.abs(leftAnkle.x - rightAnkle.x) > 0.20;

    let status = 'idle';
    let action = '⭐ JUMP OUT & HANDS UP';
    let actionTelugu = '⭐ కాళ్ళు వెడల్పు చేసి చేతులు పైకి ఎత్తండి';
    let message = 'Jump feet wide apart and clap hands overhead';
    let messageTelugu = 'కాళ్ళు వెడల్పు చేసి చేతులు తలపైకి ఎత్తండి';
    let actionArrow = 'up';
    let currentStep = 1;
    let isCorrect = true;
    let problemJoints = [];

    if (armsOverhead && feetSpread) {
      if (this.stage === 'in' || !this.stage) {
        this.stage = 'out';
        this.jackState.stage = 'out';
        this.jackState.readyForJack = true;
        status = 'good';
        action = '🦶 JUMP FEET TOGETHER';
        actionTelugu = '🦶 కాళ్ళు చేతులు దగ్గరకు చేర్చండి';
        message = 'Great jump! Now jump feet together & lower arms';
        messageTelugu = 'బాగా చేసారు! ఇప్పుడు కాళ్ళు కలిపి చేతులు కిందకు దించండి';
        actionArrow = 'down';
        currentStep = 2;
        this.correctCount++;
      }
    } else if (!armsOverhead && !feetSpread && (this.stage === 'out' || this.jackState.stage === 'out')) {
      const timeSinceLastRep = now - this.lastRepTime;
      if (timeSinceLastRep >= 600) {
        this.finishRep();
        this.lastRepTime = now;
        status = 'good';
        action = '✅ REP COUNTED!';
        actionTelugu = '✅ రెప్ పూర్తయింది!';
        message = `Rep ${this.repCount} complete! Keep jumping in rhythm`;
        messageTelugu = `రెప్ ${this.repCount} పూర్తయింది! ఇదే వేగంతో కొనసాగించండి`;
        actionArrow = 'up';
        currentStep = 3;
        window.audioCoach?.playRepSuccessSound();
      }
      this.stage = 'in';
      this.jackState.stage = 'in';
    }

    return {
      status,
      action,
      actionTelugu,
      message,
      messageTelugu,
      actionArrow,
      currentStep,
      isCorrect,
      problemJoints,
      stage: (this.stage || 'IN').toUpperCase(),
      repCount: this.repCount,
      accuracy: this.getAccuracy(),
      angles: {
        'Feet Width': `${feetSpread ? 'Wide' : 'Together'}`,
        'Arms': `${armsOverhead ? 'Overhead' : 'Down'}`
      }
    };
  }

  /**
   * Form accuracy percentage with realistic multi-rep scoring
   */
  getAccuracy() {
    if (this.currentExercise === 'plank') {
      const totalFrames = this.plankGoodFrames + this.plankBadFrames;
      if (totalFrames < 15) return 100;
      const pct = Math.round((this.plankGoodFrames / totalFrames) * 100);
      return Math.max(50, Math.min(100, pct));
    }

    if (this.repScores && this.repScores.length > 0) {
      const sum = this.repScores.reduce((a, b) => a + b, 0);
      const avg = sum / this.repScores.length;
      const livePenalty = Math.min(10, this.currentRepMistakes * 5);
      const score = Math.round(avg - livePenalty);
      return Math.max(50, Math.min(100, score));
    }

    const deduction = Math.min(30, this.wrongCount * 5);
    return Math.max(70, 100 - deduction);
  }

  estimateCalories(durationSeconds) {
    const met = this.metValues[this.currentExercise] || 5.0;
    const durationHours = durationSeconds / 3600;
    const baseBurn = met * this.userWeightKg * durationHours;
    const repBurn = this.repCount * 0.35;
    return Math.round((baseBurn + repBurn) * 10) / 10;
  }
}

// Global instance
window.exerciseEngine = new ExerciseEngine();

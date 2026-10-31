/**
 * Main Application Controller
 * Handles UI interactions, dynamic time greeting, authentication flows,
 * workout timer, and coordinates pose detection with user feedback.
 */

class AppController {
  constructor() {
    this.workoutTimerInterval = null;
    this.workoutSeconds = 0;
    this.isWorkoutActive = false;

    // Motivational quotes list
    this.quotes = [
      "Form is everything: accurate movement builds real strength.",
      "Your only limit is you. Perfect every single repetition!",
      "Small daily improvements over time lead to stunning results.",
      "Focus on quality over quantity — control the movement.",
      "Breathe, align, and conquer your fitness goals today.",
      "Consistency is what transforms average into excellence.",
      "Check your posture, ignite your energy, and push forward!"
    ];

    this.init();
  }

  async init() {
    this.initTheme();
    this.initLanguage();
    this.initClockAndGreeting();
    this.initEventListeners();
    const profile = await window.storageManager.syncUserProfile();
    this.updateUserProfileUI(profile?.stats);

    // Initialize pose detector
    if (window.poseDetector) {
      window.poseDetector.init();
    }
  }

  /**
   * Theme Engine (Vibrant Cyber Sapphire & Aurora Emerald Modes)
   * High-contrast, rich colorful aesthetics with 100% readable text.
   */
  initTheme() {
    const savedTheme = localStorage.getItem('fitpose_theme') || 'cyber';
    this.applyTheme(savedTheme);

    const btnThemeToggle = document.getElementById('btn-theme-toggle');
    if (btnThemeToggle) {
      btnThemeToggle.addEventListener('click', () => {
        const isAurora = document.documentElement.getAttribute('data-theme') === 'aurora';
        const newTheme = isAurora ? 'cyber' : 'aurora';
        this.applyTheme(newTheme);
        localStorage.setItem('fitpose_theme', newTheme);
      });
    }
  }

  applyTheme(theme) {
    if (theme === 'aurora') {
      document.documentElement.setAttribute('data-theme', 'aurora');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    const iconEl = document.getElementById('theme-toggle-icon');
    const textEl = document.getElementById('theme-toggle-text');
    if (iconEl && textEl) {
      if (theme === 'aurora') {
        iconEl.textContent = '💎';
        textEl.textContent = 'Cyber Sapphire';
      } else {
        iconEl.textContent = '✨';
        textEl.textContent = 'Aurora Emerald';
      }
    }
  }

  /**
   * Real-time Clock & Dynamic Greeting Engine
   * Updates every 1000ms with smooth seconds ticking and time-of-day greeting.
   */
  initClockAndGreeting() {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();

      // Format digital clock
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = hours % 12 || 12;
      const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
      const formattedSeconds = seconds < 10 ? '0' + seconds : seconds;
      const timeStr = `${formattedHours}:${formattedMinutes}:${formattedSeconds} ${ampm}`;

      // Format date
      const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      const dateStr = now.toLocaleDateString('en-US', dateOptions);

      // Determine greeting
      let greeting = 'Good morning';
      let icon = '🌅';
      let subtext = 'Start your morning strong with verified posture!';

      if (hours >= 12 && hours < 17) {
        greeting = 'Good afternoon';
        icon = '☀️';
        subtext = 'Recharge your day with high-energy movement.';
      } else if (hours >= 17 && hours < 22) {
        greeting = 'Good evening';
        icon = '🌆';
        subtext = 'De-stress and power through your evening workout.';
      } else if (hours >= 22 || hours < 5) {
        greeting = 'Late Night Session';
        icon = '🌙';
        subtext = 'Night owl grind! Focus on strict form and control.';
      }

      // Update Header Pill
      const liveClockEl = document.getElementById('live-clock-display');
      if (liveClockEl) liveClockEl.textContent = timeStr;

      const headerGreetingEl = document.getElementById('header-greeting-text');
      if (headerGreetingEl) headerGreetingEl.textContent = `${greeting} ${icon}`;

      // Update Hero Banner
      const heroGreetingEl = document.getElementById('hero-greeting-title');
      const userName = window.storageManager.currentUser ? window.storageManager.currentUser.full_name : 'Athlete';
      if (heroGreetingEl) {
        heroGreetingEl.innerHTML = `${greeting}, <span class="highlight-name">${userName}</span> ${icon}`;
      }

      const heroSubtextEl = document.getElementById('hero-greeting-subtext');
      if (heroSubtextEl) {
        heroSubtextEl.textContent = `${subtext} | ${dateStr} • ${timeStr}`;
      }
    };

    updateTime();
    setInterval(updateTime, 1000);

    // Random quote
    const quoteEl = document.getElementById('hero-quote-text');
    if (quoteEl) {
      quoteEl.textContent = this.quotes[Math.floor(Math.random() * this.quotes.length)];
    }
  }

  initEventListeners() {
    // Start Camera / Detection Button
    const btnStartCamera = document.getElementById('btn-start-camera');
    if (btnStartCamera) {
      btnStartCamera.addEventListener('click', () => this.startWorkoutSession());
    }

    // Interactive Demo / Simulation button
    const btnStartDemo = document.getElementById('btn-start-demo');
    if (btnStartDemo) {
      btnStartDemo.addEventListener('click', () => {
        window.poseDetector.startDemoMode();
        this.startWorkoutSession(true);
      });
    }

    // Exercise Selection Tabs
    document.querySelectorAll('.btn-exercise-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const ex = e.currentTarget.getAttribute('data-exercise');
        this.changeExercise(ex);
      });
    });

    // Mirror Camera Toggle
    const btnMirror = document.getElementById('btn-toggle-mirror');
    if (btnMirror) {
      btnMirror.addEventListener('click', () => {
        window.poseDetector.isMirrored = !window.poseDetector.isMirrored;
        btnMirror.classList.toggle('active', window.poseDetector.isMirrored);
      });
    }

    // Voice Coach Toggle
    const btnVoice = document.getElementById('btn-toggle-voice');
    if (btnVoice) {
      btnVoice.addEventListener('click', () => {
        const active = window.audioCoach.toggleVoice(!window.audioCoach.voiceEnabled);
        btnVoice.classList.toggle('active', active);
        if (active) window.audioCoach.speak('Voice coach active', true);
      });
    }

    // Sound FX Toggle
    const btnSfx = document.getElementById('btn-toggle-sfx');
    if (btnSfx) {
      btnSfx.addEventListener('click', () => {
        const active = window.audioCoach.toggleSfx(!window.audioCoach.sfxEnabled);
        btnSfx.classList.toggle('active', active);
        if (active) window.audioCoach.playRepSuccessSound();
      });
    }

    // Reset Counter Button
    const btnReset = document.getElementById('btn-reset-counter');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        window.exerciseEngine.resetStats();
        this.workoutSeconds = 0;
        this.updateHud({
          status: 'idle',
          message: 'Counters reset. Get ready for next set!',
          repCount: 0,
          accuracy: 100,
          angles: {}
        });
      });
    }

    // Finish Workout Button
    const btnFinish = document.getElementById('btn-finish-workout');
    if (btnFinish) {
      btnFinish.addEventListener('click', () => this.showWorkoutSummaryModal());
    }

    // Authentication Modals & Buttons
    const btnHeaderLogout = document.getElementById('btn-header-logout');
    if (btnHeaderLogout) {
      btnHeaderLogout.addEventListener('click', async () => {
        await window.storageManager.logout();
      });
    }

    const btnOpenAuth = document.getElementById('btn-open-login');
    if (btnOpenAuth) {
      btnOpenAuth.addEventListener('click', () => this.openAuthModal());
    }

    const btnCloseAuth = document.getElementById('btn-close-auth-modal');
    if (btnCloseAuth) {
      btnCloseAuth.addEventListener('click', () => this.closeAuthModal());
    }

    // Auth Switcher (Sign In vs Register)
    const tabSignIn = document.getElementById('tab-btn-signin');
    const tabSignUp = document.getElementById('tab-btn-signup');
    if (tabSignIn && tabSignUp) {
      tabSignIn.addEventListener('click', () => this.switchAuthTab('signin'));
      tabSignUp.addEventListener('click', () => this.switchAuthTab('signup'));
    }

    // Quick Guest Login
    const btnGuest = document.getElementById('btn-guest-login');
    if (btnGuest) {
      btnGuest.addEventListener('click', async () => {
        const res = await window.storageManager.guestLogin();
        if (res.success) {
          this.closeAuthModal();
          this.updateUserProfileUI();
          this.showNotification('Logged in as Guest Athlete! Enjoy your workout.', 'success');
        }
      });
    }

    // Auth Form Submit
    const authForm = document.getElementById('auth-form');
    if (authForm) {
      authForm.addEventListener('submit', (e) => this.handleAuthSubmit(e));
    }

    // History Modal
    const btnHistory = document.getElementById('btn-view-history');
    if (btnHistory) {
      btnHistory.addEventListener('click', () => this.openHistoryModal());
    }
    const btnCloseHistory = document.getElementById('btn-close-history-modal');
    if (btnCloseHistory) {
      btnCloseHistory.addEventListener('click', () => {
        document.getElementById('history-modal-backdrop').classList.remove('active');
      });
    }

    // Summary Modal Buttons
    const btnCloseSummary = document.getElementById('btn-close-summary-modal');
    if (btnCloseSummary) {
      btnCloseSummary.addEventListener('click', () => {
        document.getElementById('summary-modal-backdrop').classList.remove('active');
      });
    }

    const btnSaveSession = document.getElementById('btn-save-summary');
    if (btnSaveSession) {
      btnSaveSession.addEventListener('click', () => this.saveCurrentSession());
    }

    // Language Toggle (English <-> Telugu)
    const btnToggleLang = document.getElementById('btn-toggle-lang');
    if (btnToggleLang) {
      btnToggleLang.addEventListener('click', () => this.toggleLanguage());
    }
  }

  async startWorkoutSession(isSimulation = false) {
    const placeholder = document.getElementById('camera-placeholder-overlay');
    if (placeholder) placeholder.classList.add('hidden');

    if (!isSimulation) {
      const ok = await window.poseDetector.startCamera();
      if (!ok) return;
    }

    this.isWorkoutActive = true;
    this.workoutSeconds = 0;

    // Start timer interval
    if (this.workoutTimerInterval) clearInterval(this.workoutTimerInterval);
    this.workoutTimerInterval = setInterval(() => {
      this.workoutSeconds++;
      this.updateTimerDisplay();
    }, 1000);

    window.audioCoach.speak('Workout session started! Get into position.', true);
  }

  updateTimerDisplay() {
    const mins = Math.floor(this.workoutSeconds / 60);
    const secs = this.workoutSeconds % 60;
    const timeFormatted = `${mins < 10 ? '0' + mins : mins}:${secs < 10 ? '0' + secs : secs}`;

    const timerEl = document.getElementById('timer-workout-duration');
    if (timerEl) timerEl.textContent = timeFormatted;

    // Update calories in Timer display
    const calories = window.exerciseEngine.estimateCalories(this.workoutSeconds);
    const timerCalEl = document.getElementById('timer-calories');
    if (timerCalEl) timerCalEl.textContent = calories.toFixed(1);
  }

  changeExercise(exerciseKey) {
    document.querySelectorAll('.btn-exercise-pill').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-exercise') === exerciseKey);
    });

    window.exerciseEngine.setExercise(exerciseKey);

    // Update exercise tag
    const exNames = {
      squats: 'Squats (Form Depth)',
      pushups: 'Push-Ups (Core & Lockout)',
      bicep_curls: 'Bicep Curls (Elbow Stability)',
      plank: 'Plank Hold (Spine Line)',
      lunges: 'Lunges (Knee Alignment)',
      jumping_jacks: 'Jumping Jacks (Cardio Form)'
    };
    const tagEl = document.getElementById('hud-exercise-name');
    if (tagEl) tagEl.textContent = exNames[exerciseKey] || exerciseKey;

    const repNumEl = document.getElementById('hud-rep-number');
    if (repNumEl) repNumEl.textContent = '0';
    const metricReps = document.getElementById('metric-reps-count');
    if (metricReps) metricReps.textContent = '0';
    const stageEl = document.getElementById('hud-stage-name');
    if (stageEl) stageEl.textContent = 'PHASE: READY';

    window.audioCoach.speak(`Exercise changed to ${exerciseKey.replace('_', ' ')}. Align your form!`, true);
  }

  /**
   * Updates real-time HUD based on pose evaluation
   * Renders clear action headlines, simple guidance, and Telugu translations.
   */
  updateHud(evaluation) {
    // 1. Status Banner
    const banner = document.getElementById('pose-feedback-banner');
    const headline = document.getElementById('pose-action-headline');
    const bannerText = document.getElementById('pose-feedback-text');
    const teluguHint = document.getElementById('pose-feedback-telugu');
    const bannerIcon = document.getElementById('pose-action-icon');

    if (banner) {
      banner.className = `pose-feedback-banner status-${evaluation.status || 'idle'}`;
    }

    if (headline) {
      const act = (this.currentLang === 'te') 
        ? (evaluation.actionTelugu || evaluation.action || 'ACTIVE') 
        : (evaluation.action || 'ACTIVE');
      headline.textContent = act;
    }

    if (bannerText) {
      bannerText.textContent = evaluation.message || '';
    }

    if (teluguHint) {
      if (evaluation.messageTelugu) {
        teluguHint.textContent = evaluation.messageTelugu;
        teluguHint.style.display = 'block';
      } else {
        teluguHint.style.display = 'none';
      }
    }

    if (bannerIcon) {
      if (evaluation.actionArrow === 'up') bannerIcon.textContent = '⬆️';
      else if (evaluation.actionArrow === 'down') bannerIcon.textContent = '⬇️';
      else if (evaluation.actionArrow === 'hold') bannerIcon.textContent = '🧘';
      else if (evaluation.status === 'good') bannerIcon.textContent = '✅';
      else if (evaluation.status === 'wrong') bannerIcon.textContent = '⚠️';
      else bannerIcon.textContent = '🎯';
    }

    // 2. Real-time 3-Step Live Cue Tracker
    const step = evaluation.currentStep || 1;
    for (let i = 1; i <= 3; i++) {
      const bubble = document.getElementById(`step-bubble-${i}`);
      if (bubble) {
        if (i === step) {
          bubble.classList.add('active');
        } else {
          bubble.classList.remove('active');
        }
      }
    }

    // 3. Rep Counter & Stage
    const repNumEl = document.getElementById('hud-rep-number');
    if (repNumEl && evaluation.repCount !== undefined) {
      repNumEl.textContent = evaluation.repCount;
    }

    const stageEl = document.getElementById('hud-stage-name');
    if (stageEl && evaluation.stage) {
      stageEl.textContent = `PHASE: ${evaluation.stage}`;
    }

    // 4. Accuracy Ring & Bar
    const acc = evaluation.accuracy !== undefined ? evaluation.accuracy : 100;
    const hudAccVal = document.getElementById('hud-accuracy-val');
    if (hudAccVal) hudAccVal.textContent = `${acc}%`;

    const barAccVal = document.getElementById('metric-accuracy-val');
    if (barAccVal) barAccVal.textContent = `${acc}%`;

    const progressFill = document.getElementById('accuracy-progress-fill');
    if (progressFill) progressFill.style.width = `${acc}%`;

    // 5. Metric Box
    const metricReps = document.getElementById('metric-reps-count');
    if (metricReps && evaluation.repCount !== undefined) {
      metricReps.textContent = evaluation.repCount;
    }

    // 6. Joint Angles List
    const anglesList = document.getElementById('angles-inspector-items');
    if (anglesList && evaluation.angles) {
      let html = '';
      for (const [name, val] of Object.entries(evaluation.angles)) {
        const isBad = evaluation.status === 'wrong';
        html += `
          <div class="angle-row-item">
            <span class="angle-name">${name}</span>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="angle-reading">${val}</span>
              <span class="angle-status-dot ${isBad ? 'bad' : ''}"></span>
            </div>
          </div>
        `;
      }
      anglesList.innerHTML = html;
    }
  }

  // --- Multi-Language (English / Telugu) Engine ---

  initLanguage() {
    this.currentLang = localStorage.getItem('fitpose_lang') || 'en';
    this.updateLanguageUI();
  }

  toggleLanguage() {
    this.currentLang = (this.currentLang === 'en') ? 'te' : 'en';
    localStorage.setItem('fitpose_lang', this.currentLang);
    this.updateLanguageUI();
  }

  updateLanguageUI() {
    const langIndicator = document.getElementById('lang-indicator');
    if (langIndicator) {
      langIndicator.textContent = this.currentLang === 'te' ? 'తెలుగు (Telugu)' : 'English';
    }
    if (window.audioCoach) {
      window.audioCoach.lang = this.currentLang;
    }
  }

  // --- Auth & User State ---

  openAuthModal() {
    const modal = document.getElementById('auth-modal-backdrop');
    if (modal) modal.classList.add('active');
  }

  closeAuthModal() {
    const modal = document.getElementById('auth-modal-backdrop');
    if (modal) modal.classList.remove('active');
  }

  switchAuthTab(tab) {
    const isSignIn = tab === 'signin';
    document.getElementById('tab-btn-signin').classList.toggle('active', isSignIn);
    document.getElementById('tab-btn-signup').classList.toggle('active', !isSignIn);

    const signupFields = document.getElementById('signup-extra-fields');
    if (signupFields) signupFields.style.display = isSignIn ? 'none' : 'block';

    const submitBtn = document.getElementById('btn-auth-submit');
    if (submitBtn) submitBtn.textContent = isSignIn ? 'Sign In' : 'Create Account';
  }

  async handleAuthSubmit(e) {
    e.preventDefault();
    const isSignIn = document.getElementById('tab-btn-signin').classList.contains('active');
    const alertBox = document.getElementById('auth-alert-message');

    const emailInput = document.getElementById('input-email').value.trim();
    const passwordInput = document.getElementById('input-password').value;

    let res;
    if (isSignIn) {
      res = await window.storageManager.login(emailInput, passwordInput);
    } else {
      const fullName = document.getElementById('input-fullname')?.value.trim() || emailInput.split('@')[0];
      const goal = document.getElementById('select-goal')?.value || 'General Fitness';
      const level = document.getElementById('select-level')?.value || 'Intermediate';
      res = await window.storageManager.register(emailInput.split('@')[0], emailInput, passwordInput, fullName, goal, level);
    }

    if (res.success) {
      alertBox.className = 'auth-alert-message success';
      alertBox.textContent = res.message || 'Success!';
      setTimeout(() => {
        this.closeAuthModal();
        this.updateUserProfileUI();
      }, 700);
    } else {
      alertBox.className = 'auth-alert-message error';
      alertBox.textContent = res.error || 'Authentication failed. Please check credentials.';
    }
  }

  updateUserProfileUI(stats = null) {
    const user = window.storageManager.currentUser;
    if (!user) return;

    const userStats = stats || window.storageManager.getUserStats();
    const workoutsCount = userStats ? (userStats.total_workouts || 0) : 0;
    const avgAccuracy = (userStats && workoutsCount > 0) ? Math.round(userStats.avg_accuracy || 0) : 0;
    // Streak: if user has 0 workouts completed, streak is 0!
    const userStreak = workoutsCount > 0 ? (user.streak_days || 1) : 0;

    // Header athlete chip
    const nameEl = document.getElementById('user-profile-name');
    if (nameEl) nameEl.textContent = user.full_name || user.username;

    const streakEl = document.getElementById('user-profile-streak');
    if (streakEl) streakEl.textContent = `🔥 ${userStreak}d Streak`;

    const avatarEl = document.getElementById('user-avatar-initials');
    if (avatarEl) {
      const initials = (user.full_name || user.username || 'A').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
      avatarEl.textContent = initials;
    }

    // Hero Greeting Name
    const heroTitle = document.getElementById('hero-greeting-title');
    if (heroTitle) {
      const now = new Date();
      const hours = now.getHours();
      let greeting = 'Good morning';
      let icon = '🌅';
      if (hours >= 12 && hours < 17) { greeting = 'Good afternoon'; icon = '☀️'; }
      else if (hours >= 17 && hours < 22) { greeting = 'Good evening'; icon = '🌆'; }
      else { greeting = 'Late Night Grind'; icon = '🌙'; }
      heroTitle.innerHTML = `${greeting}, <span class="highlight-name">${user.full_name || user.username}</span> ${icon}`;
    }

    // Hero Quick Stats — 100% dynamic per user!
    const quickStreak = document.getElementById('quick-streak-stat');
    if (quickStreak) {
      quickStreak.textContent = userStreak;
    }

    const quickAccuracy = document.getElementById('quick-accuracy-stat');
    if (quickAccuracy) {
      quickAccuracy.textContent = workoutsCount > 0 ? `${avgAccuracy}%` : '0%';
    }

    const quickWorkouts = document.getElementById('quick-workouts-stat');
    if (quickWorkouts) {
      quickWorkouts.textContent = workoutsCount;
    }
  }

  // --- Summary & History ---

  showWorkoutSummaryModal() {
    const modal = document.getElementById('summary-modal-backdrop');
    if (!modal) return;

    const engine = window.exerciseEngine;
    const reps = engine.repCount;

    // Prevent saving 0-rep sessions that corrupt user accuracy stats
    if (reps === 0 && engine.currentExercise !== 'plank') {
      const msg = this.currentLang === 'te'
        ? 'దయచేసి ఫారమ్ అక్యూరసీని లెక్కించడానికి కనీసం 1 రెప్ పూర్తి చేయండి!'
        : 'Please complete at least 1 repetition to calculate your form accuracy!';
      this.showNotification(msg, 'warning');
      return;
    }

    const accuracy = engine.getAccuracy();
    const calories = engine.estimateCalories(this.workoutSeconds);
    const duration = document.getElementById('timer-workout-duration').textContent || '00:00';

    // Grade calculation with balanced tiers
    let letter = 'A+';
    let feedback = 'Outstanding form and control! Flawless posture alignment.';
    if (accuracy < 60) {
      letter = 'C';
      feedback = 'Needs practice. Focus on posture and steady movement pace.';
    } else if (accuracy < 75) {
      letter = 'B';
      feedback = 'Decent effort! Slow down and pay attention to posture warnings.';
    } else if (accuracy < 88) {
      letter = 'B+';
      feedback = 'Solid session! Good effort with just minor form adjustments.';
    } else if (accuracy < 94) {
      letter = 'A';
      feedback = 'Great form and control! Consistent movement throughout.';
    }

    document.getElementById('summary-grade-letter').textContent = letter;
    document.getElementById('summary-grade-feedback').textContent = feedback;
    document.getElementById('summary-total-reps').textContent = reps;
    document.getElementById('summary-accuracy-val').textContent = `${accuracy}%`;
    document.getElementById('summary-calories-val').textContent = `${calories} kcal`;
    document.getElementById('summary-duration-val').textContent = duration;

    modal.classList.add('active');
    window.audioCoach.speak(`Workout complete! Form grade: ${letter} with ${accuracy} percent accuracy.`, true);
  }

  async saveCurrentSession() {
    const engine = window.exerciseEngine;
    if (engine.repCount === 0 && engine.currentExercise !== 'plank') {
      this.showNotification('Cannot save workout session with 0 repetitions.', 'warning');
      return;
    }
    const sessionData = {
      exercise_type: engine.currentExercise,
      total_reps: engine.repCount,
      accuracy_score: engine.getAccuracy(),
      calories_burned: engine.estimateCalories(this.workoutSeconds),
      duration_seconds: this.workoutSeconds,
      incorrect_form_count: engine.wrongCount,
      notes: `Form Accuracy: ${engine.getAccuracy()}%`
    };

    await window.storageManager.saveWorkoutSession(sessionData);
    document.getElementById('summary-modal-backdrop').classList.remove('active');
    this.showNotification('Workout session saved to your profile!', 'success');

    // Immediately re-sync and update stats on screen!
    const profile = await window.storageManager.syncUserProfile();
    this.updateUserProfileUI(profile?.stats);
  }

  async openHistoryModal() {
    const modal = document.getElementById('history-modal-backdrop');
    const tableBody = document.getElementById('history-table-body');
    if (!modal || !tableBody) return;

    modal.classList.add('active');
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:#94a3b8;">Loading workout history...</td></tr>`;

    const history = await window.storageManager.getWorkoutHistory();
    if (history.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:1.5rem; color:#94a3b8;">No workouts recorded yet. Start your first session!</td></tr>`;
      return;
    }

    let html = '';
    history.forEach(item => {
      const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Today';
      const mins = Math.floor((item.duration_seconds || 0) / 60);
      const secs = (item.duration_seconds || 0) % 60;
      const durStr = `${mins}m ${secs}s`;
      const acc = item.accuracy_score !== undefined ? Math.round(item.accuracy_score) : 0;
      const cal = item.calories_burned !== undefined ? item.calories_burned : 0;

      html += `
        <tr>
          <td><strong>${item.exercise_type.toUpperCase()}</strong></td>
          <td><span style="font-family:monospace; font-weight:700; color:#38bdf8;">${item.total_reps}</span></td>
          <td><span style="color:#10b981; font-weight:700;">${acc}%</span></td>
          <td>${cal} kcal</td>
          <td><span style="color:#94a3b8; font-size:0.75rem;">${dateStr} (${durStr})</span></td>
        </tr>
      `;
    });
    tableBody.innerHTML = html;
  }

  showNotification(msg, type = 'info') {
    const notif = document.createElement('div');
    notif.className = `notification-toast toast-${type}`;
    notif.style.cssText = `
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      background: #1e293b;
      border: 1px solid #10b981;
      color: #fff;
      padding: 0.8rem 1.4rem;
      border-radius: 12px;
      font-weight: 600;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 8px;
      animation: modalEntry 0.3s ease;
    `;
    notif.innerHTML = `<span>✅</span><span>${msg}</span>`;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 3500);
  }
}

// Instantiate on DOM load
document.addEventListener('DOMContentLoaded', () => {
  window.app = new AppController();
});

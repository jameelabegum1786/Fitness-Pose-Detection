/**
 * Storage & API Client Manager
 * Manages user authentication, profile data, and workout session logging.
 * Integrates with Flask backend REST endpoints with strictly per-user localStorage isolation.
 */

class StorageManager {
  constructor() {
    this.currentUser = this.loadUserFromStorage();
    this.currentStats = this.loadStatsFromStorage();
  }

  loadStatsFromStorage() {
    try {
      const userId = this.currentUser ? (this.currentUser.id || this.currentUser.username) : 'guest';
      const data = localStorage.getItem(`fitpose_stats_${userId}`);
      return data ? JSON.parse(data) : { total_workouts: 0, total_reps: 0, total_calories: 0, avg_accuracy: 0 };
    } catch (e) {
      return { total_workouts: 0, total_reps: 0, total_calories: 0, avg_accuracy: 0 };
    }
  }

  saveStatsToStorage(stats) {
    this.currentStats = stats;
    try {
      const userId = this.currentUser ? (this.currentUser.id || this.currentUser.username) : 'guest';
      localStorage.setItem(`fitpose_stats_${userId}`, JSON.stringify(stats));
    } catch (e) {}
  }

  async syncUserProfile() {
    try {
      const res = await fetch('/api/user/profile');
      if (res.status === 401) {
        this.clearUser();
        if (window.location.protocol === 'file:') {
          window.location.href = './login.html';
        } else {
          window.location.href = '/login';
        }
        return null;
      }
      const data = await res.json();
      if (data.success && data.user) {
        this.saveUserToStorage(data.user);
        const stats = data.stats || { total_workouts: 0, total_reps: 0, total_calories: 0, avg_accuracy: 0 };
        this.saveStatsToStorage(stats);
        sessionStorage.setItem('fitpose_authenticated', 'true');
        return { user: data.user, stats };
      }
    } catch (e) {
      console.warn('Could not sync profile from server', e);
    }
    return { user: this.currentUser, stats: this.getUserStats() };
  }

  getUserStats() {
    if (this.currentStats && this.currentStats.total_workouts !== undefined) {
      return this.currentStats;
    }
    return this.getUserLocalStats();
  }

  getUserLocalStats() {
    const workouts = this.getLocalWorkoutsForUser();
    if (!workouts || workouts.length === 0) {
      return { total_workouts: 0, total_reps: 0, total_calories: 0, avg_accuracy: 0 };
    }
    const total_workouts = workouts.length;
    let total_reps = 0;
    let total_calories = 0;
    let sum_accuracy = 0;
    let validAccuracyCount = 0;
    workouts.forEach(w => {
      const reps = Number(w.total_reps) || 0;
      total_reps += reps;
      total_calories += (Number(w.calories_burned) || 0);
      if (reps > 0 || w.exercise_type === 'plank') {
        sum_accuracy += (Number(w.accuracy_score) || 0);
        validAccuracyCount++;
      }
    });
    return {
      total_workouts,
      total_reps,
      total_calories: Math.round(total_calories * 10) / 10,
      avg_accuracy: validAccuracyCount > 0 ? Math.round(sum_accuracy / validAccuracyCount) : 0
    };
  }

  getLocalWorkoutsForUser() {
    try {
      const userId = this.currentUser ? (this.currentUser.id || this.currentUser.username) : 'guest';
      return JSON.parse(localStorage.getItem(`fitpose_workouts_${userId}`) || '[]');
    } catch (e) {
      return [];
    }
  }

  loadUserFromStorage() {
    try {
      const data = localStorage.getItem('fitpose_user');
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  saveUserToStorage(user) {
    this.currentUser = user;
    try {
      localStorage.setItem('fitpose_user', JSON.stringify(user));
      sessionStorage.setItem('fitpose_authenticated', 'true');
      this.currentStats = this.loadStatsFromStorage();
    } catch (e) {
      console.warn('LocalStorage save failed', e);
    }
  }

  clearUser() {
    this.currentUser = null;
    this.currentStats = { total_workouts: 0, total_reps: 0, total_calories: 0, avg_accuracy: 0 };
    try {
      localStorage.removeItem('fitpose_user');
      sessionStorage.removeItem('fitpose_authenticated');
    } catch (e) {}
  }

  // --- API Integrations ---

  async register(username, email, password, fullName, goal, level) {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username, email, password,
          full_name: fullName,
          fitness_goal: goal,
          fitness_level: level
        })
      });
      const data = await res.json();
      if (data.success && data.user) {
        this.saveUserToStorage(data.user);
        this.saveStatsToStorage({ total_workouts: 0, total_reps: 0, total_calories: 0, avg_accuracy: 0 });
      }
      return data;
    } catch (err) {
      // Offline fallback
      const mockUser = {
        id: Date.now(),
        username,
        email,
        full_name: fullName || username,
        fitness_goal: goal,
        fitness_level: level,
        streak_days: 0
      };
      this.saveUserToStorage(mockUser);
      this.saveStatsToStorage({ total_workouts: 0, total_reps: 0, total_calories: 0, avg_accuracy: 0 });
      return { success: true, user: mockUser, message: 'Welcome to FitPose AI!' };
    }
  }

  async login(usernameOrEmail, password) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username_or_email: usernameOrEmail, password })
      });
      const data = await res.json();
      if (data.success && data.user) {
        this.saveUserToStorage(data.user);
      }
      return data;
    } catch (err) {
      // Offline fallback
      const mockUser = {
        id: Date.now(),
        username: usernameOrEmail,
        full_name: usernameOrEmail,
        fitness_goal: 'General Fitness',
        fitness_level: 'Intermediate',
        streak_days: 0
      };
      this.saveUserToStorage(mockUser);
      return { success: true, user: mockUser, message: 'Welcome back!' };
    }
  }

  async guestLogin() {
    try {
      const res = await fetch('/api/auth/guest', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.user) {
        this.saveUserToStorage(data.user);
      }
      return data;
    } catch (err) {
      const guest = {
        id: 9999,
        username: 'guest_athlete',
        full_name: 'Guest Athlete',
        fitness_goal: 'Quick Workout',
        fitness_level: 'Beginner',
        streak_days: 0,
        is_guest: true
      };
      this.saveUserToStorage(guest);
      return { success: true, user: guest, message: 'Logged in as Guest Athlete!' };
    }
  }

  async logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    this.clearUser();
    if (window.location.protocol === 'file:') {
      window.location.href = './login.html';
    } else {
      window.location.href = '/login';
    }
    return { success: true };
  }

  async saveWorkoutSession(sessionData) {
    const userId = this.currentUser ? (this.currentUser.id || this.currentUser.username) : 'guest';
    
    // Save to user-specific LocalStorage history
    try {
      const key = `fitpose_workouts_${userId}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.unshift({
        id: Date.now(),
        date: new Date().toISOString(),
        ...sessionData
      });
      localStorage.setItem(key, JSON.stringify(existing.slice(0, 30)));
    } catch (e) {}

    // Send to backend
    try {
      const res = await fetch('/api/workouts/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData)
      });
      const data = await res.json();
      // Refresh user stats
      await this.syncUserProfile();
      return data;
    } catch (err) {
      // Local stat recalculation
      const localStats = this.getUserLocalStats();
      this.saveStatsToStorage(localStats);
      return { success: true, message: 'Workout saved locally!' };
    }
  }

  async getWorkoutHistory() {
    try {
      const res = await fetch('/api/workouts/history');
      const data = await res.json();
      if (data.success && Array.isArray(data.history)) {
        return data.history;
      }
    } catch (err) {}

    // User-specific local fallback
    return this.getLocalWorkoutsForUser();
  }
}

window.storageManager = new StorageManager();

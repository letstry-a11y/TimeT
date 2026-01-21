export interface Translations {
  common: {
    appName: string;
    loading: string;
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    create: string;
    confirm: string;
    viewAll: string;
    viewDetails: string;
    noData: string;
    hours: string;
    total: string;
  };

  nav: {
    dashboard: string;
    visions: string;
    goals: string;
    tracker: string;
    reports: string;
    logout: string;
  };

  auth: {
    login: string;
    register: string;
    email: string;
    password: string;
    username: string;
    confirmPassword: string;
    welcomeBack: string;
    createAccount: string;
    loginToAccount: string;
    startTracking: string;
    noAccount: string;
    hasAccount: string;
    registerNow: string;
    loginNow: string;
    loginSuccess: string;
    loginFailed: string;
    registerSuccess: string;
    registerFailed: string;
    emailRequired: string;
    emailInvalid: string;
    passwordRequired: string;
    passwordMinLength: string;
    usernameRequired: string;
    usernameMinLength: string;
    passwordMismatch: string;
    emailPlaceholder: string;
    usernamePlaceholder: string;
    passwordPlaceholder: string;
    confirmPasswordPlaceholder: string;
  };

  dashboard: {
    greeting: string;
    yearQuarter: string;
    tagline: string;
    visions: string;
    quarterlyGoals: string;
    weeklyInput: string;
    averageProgress: string;
    inProgress: string;
    startedAt: string;
    thisQuarterGoals: string;
    weeklyDistribution: string;
    viewReport: string;
    visionsOverview: string;
    manageVisions: string;
    noVisions: string;
    noQuarterlyGoals: string;
    goCreate: string;
    topGoalsThisWeek: string;
    noTimeRecords: string;
    target: string;
    noTarget: string;
  };

  goals: {
    management: string;
    description: string;
    yearlyGoal: string;
    quarterlyGoal: string;
    createYearlyGoal: string;
    createQuarterlyGoal: string;
    editGoal: string;
    goalTitle: string;
    goalTitlePlaceholder: string;
    goalDescription: string;
    descriptionPlaceholder: string;
    relatedVision: string;
    relatedYearlyGoal: string;
    selectVision: string;
    selectYearlyGoal: string;
    targetHours: string;
    noGoals: string;
    noGoalsHint: string;
    noQuarterlyGoals: string;
    clickToAdd: string;
    deleteConfirm: string;
    unlinkedQuarterlyGoals: string;
    addQuarterlyGoal: string;
    year: string;
    quarter: string;
    all: string;
    yearFormat: string;
    q1: string;
    q2: string;
    q3: string;
    q4: string;
    notStarted: string;
    inProgress: string;
    completed: string;
    paused: string;
    cancelled: string;
    loadFailed: string;
    createSuccess: string;
    createFailed: string;
    updateSuccess: string;
    updateFailed: string;
    deleteSuccess: string;
    deleteFailed: string;
    status: string;
    progress: string;
    timeSpent: string;
    type: string;
  };

  tracker: {
    title: string;
    description: string;
    start: string;
    stop: string;
    selectGoal: string;
    selectQuarterlyGoal: string;
    note: string;
    notePlaceholder: string;
    manualEntry: string;
    recentRecords: string;
    totalRecords: string;
    noRecords: string;
    startTime: string;
    endTime: string;
    unknownGoal: string;
    clockIn: string;
    manual: string;
    deleteConfirm: string;
    startSuccess: string;
    startFailed: string;
    stopSuccess: string;
    stopFailed: string;
    addSuccess: string;
    addFailed: string;
    deleteSuccess: string;
    deleteFailed: string;
    loadFailed: string;
  };

  visions: {
    title: string;
    description: string;
    createVision: string;
    editVision: string;
    visionTitle: string;
    visionTitlePlaceholder: string;
    visionDescription: string;
    descriptionPlaceholder: string;
    targetYear: string;
    color: string;
    noVisions: string;
    noVisionsHint: string;
    deleteConfirm: string;
    createSuccess: string;
    createFailed: string;
    updateSuccess: string;
    updateFailed: string;
    deleteSuccess: string;
    deleteFailed: string;
    loadFailed: string;
    yearlyGoalsCount: string;
    quarterlyGoalsCount: string;
    expandGoals: string;
    collapseGoals: string;
    noAssociatedGoals: string;
  };

  reports: {
    title: string;
    description: string;
    totalTime: string;
    completedGoals: string;
    weeklyInput: string;
    weeklyDistribution: string;
    totalHours: string;
    visionAlignment: string;
    goalProgress: string;
    topGoalsThisWeek: string;
    goal: string;
    type: string;
    status: string;
    progress: string;
    timeSpent: string;
    yearly: string;
    noGoalData: string;
    wholeYear: string;
  };

  timer: {
    start: string;
    stop: string;
  };

  format: {
    minutes: string;
    hours: string;
    hoursShort: string;
  };

  meta: {
    title: string;
    description: string;
  };
}

export type Locale = 'zh-CN' | 'en-US';

/**
 * A 4-day Upper/Lower plan built for two 5 kg dumbbells and no other equipment.
 * Sets, rep ranges and cues are written out here as data.
 */
export type SessionId = 'lowerA' | 'upperA' | 'lowerB' | 'upperB'

export interface Exercise {
  /** Short, stable id: it is part of the synced field name for each logged set. */
  id: string
  name: string
  sets: number
  repMin: number
  repMax: number
  perSide: boolean
  how: string
}

export interface Session {
  id: SessionId
  title: string
  focus: string
  exercises: readonly Exercise[]
}

export const SESSION_MINUTES = '40–45'

/** In training order across the week: every muscle twice, 3–4 days apart. */
export const SESSIONS: readonly Session[] = [
  {
    id: 'lowerA',
    title: 'Lower A',
    focus: 'Front of thighs',
    exercises: [
      { id: 'bss', name: 'Bulgarian split squat', sets: 3, repMin: 8, repMax: 15, perSide: true, how: 'Both dumbbells. Back foot on a bed or chair. Take 3 s to go down.' },
      { id: 'slrdl', name: 'Single-leg Romanian deadlift', sets: 3, repMin: 10, repMax: 15, perSide: true, how: 'Both dumbbells. Hold a wall for balance. Bend at the hips until you feel a stretch in the back of your thigh.' },
      { id: 'hrsquat', name: 'Heel-raised goblet squat', sets: 2, repMin: 15, repMax: 30, perSide: false, how: 'Both dumbbells at your chest, heels on a thick book. 3 s down, 1 s pause at the bottom.' },
      { id: 'calfA', name: 'Single-leg calf raise off a stair', sets: 3, repMin: 10, repMax: 20, perSide: true, how: 'One dumbbell. Pause 2 s at the bottom, where the calf is stretched.' },
    ],
  },
  {
    id: 'upperA',
    title: 'Upper A',
    focus: 'Pushing',
    exercises: [
      { id: 'deeppush', name: 'Deep push-up', sets: 4, repMin: 8, repMax: 25, perSide: false, how: 'Hands on the dumbbells so your chest can go lower than your hands for more stretch.' },
      { id: 'invrow', name: 'Inverted row under a sturdy table', sets: 4, repMin: 8, repMax: 20, perSide: false, how: 'Lie under the table, grip the edge and pull your chest up to it, body straight. Only use a heavy, solid table and test it first. No such table? Do one-arm dumbbell rows instead.' },
      { id: 'pike', name: 'Pike push-up', sets: 3, repMin: 6, repMax: 15, perSide: false, how: 'Hips high. Lower your head toward the floor between your hands.' },
      { id: 'ohtri', name: 'Overhead triceps extension', sets: 3, repMin: 10, repMax: 20, perSide: false, how: 'One dumbbell in both hands. Lower it behind your head until the triceps are fully stretched.' },
      { id: 'curl', name: 'Dumbbell curl', sets: 3, repMin: 10, repMax: 20, perSide: false, how: "Take 3 s to lower. Don't swing." },
      { id: 'latA', name: 'Lateral raise', sets: 3, repMin: 12, repMax: 25, perSide: false, how: 'Lift with your elbows leading and stop at shoulder height.' },
    ],
  },
  {
    id: 'lowerB',
    title: 'Lower B',
    focus: 'Glutes and back of thighs',
    exercises: [
      { id: 'revlunge', name: 'Reverse lunge', sets: 3, repMin: 10, repMax: 15, perSide: true, how: 'Both dumbbells. Step back and keep the front shin fairly upright.' },
      { id: 'squat15', name: 'Goblet squat, 1.5 reps', sets: 2, repMin: 10, repMax: 20, perSide: false, how: 'Go down, come halfway up, go down again, then stand all the way up. That counts as 1 rep.' },
      { id: 'hipthrust', name: 'Single-leg hip thrust', sets: 3, repMin: 10, repMax: 20, perSide: true, how: 'Shoulders on a bed or sofa, dumbbell on your hip. Squeeze 1 s at the top.' },
      { id: 'legcurl', name: 'Towel slider leg curl', sets: 3, repMin: 6, repMax: 15, perSide: false, how: "On a smooth floor, lie on your back with heels on a towel and hips up, then pull your heels toward you. If that's too hard, only do the slow lowering part." },
      { id: 'calfB', name: 'Single-leg calf raise', sets: 3, repMin: 10, repMax: 20, perSide: true, how: 'One dumbbell, off a stair. Pause 2 s at the bottom.' },
    ],
  },
  {
    id: 'upperB',
    title: 'Upper B',
    focus: 'Pulling',
    exercises: [
      { id: 'dbrow', name: 'One-arm dumbbell row', sets: 4, repMin: 12, repMax: 25, perSide: true, how: 'Hand and knee on the bed. 3 s to lower, 2 s squeeze at the top. 5 kg only works if you go slow.' },
      { id: 'pullover', name: 'Dumbbell pullover', sets: 3, repMin: 12, repMax: 20, perSide: false, how: 'Lie across the bed, one dumbbell in both hands. Lower it behind your head for a big stretch in your back. Keep elbows slightly bent.' },
      { id: 'closepush', name: 'Close-grip push-up', sets: 4, repMin: 8, repMax: 25, perSide: false, how: 'Hands under your shoulders, elbows close to your body. Works triceps and chest.' },
      { id: 'reardelt', name: 'Bent-over rear-delt fly', sets: 3, repMin: 12, repMax: 25, perSide: false, how: 'Bend forward and raise the dumbbells out to the sides.' },
      { id: 'hammer', name: 'Hammer curl', sets: 3, repMin: 10, repMax: 20, perSide: false, how: 'Palms facing each other. Take 3 s to lower.' },
      { id: 'latB', name: 'Lateral raise', sets: 3, repMin: 12, repMax: 25, perSide: false, how: 'Lift with your elbows leading and stop at shoulder height.' },
    ],
  },
]

/** The plan's days: Tue Lower A, Wed Upper A, Fri Lower B, Sat Upper B (Sunday = 0). */
export const PLAN_WORKOUT_DAYS: readonly number[] = [2, 3, 5, 6]

/** How to make an exercise harder with only 5 kg, once every set reaches the top of its rep range. */
export const PROGRESSION_STEPS: readonly string[] = [
  'Add reps, staying inside the range',
  'Take 3–4 s to lower the weight',
  'Pause 2 s where the muscle is most stretched',
  'Switch to 1.5 reps',
  'Use a harder version (feet-raised, then archer push-ups)',
  'Add a backpack full of books',
]

export const TRAINING_RULES: readonly { title: string; text: string }[] = [
  { title: 'Effort', text: 'Finish every set with 0–3 reps left in you. The last 2 reps should be a real fight. In week 1, take one set of each exercise to failure so you learn what "2 reps left" feels like.' },
  { title: 'Rest', text: 'Rest 2–3 minutes between sets.' },
  { title: 'Warm-up', text: '5 minutes: arm circles, some squats with no weight, then one easy set of your first exercise.' },
  { title: 'Too easy?', text: 'If you can do more than about 30 reps, make the exercise harder instead of adding more reps.' },
  { title: 'Protein', text: 'About 1.6 g per kg of bodyweight a day: eggs, chicken, fish, dal, curd, milk.' },
  { title: 'Stalled?', text: 'If your reps stop going up for 2–3 weeks, fix your eating and sleep before adding more sets.' },
  { title: 'After 6–8 weeks', text: "If you're recovering well, add one set to the exercises for the muscles you care about most." },
  { title: 'Pain', text: 'Sharp pain or joint pain means stop that exercise. Normal muscle burn is fine.' },
  { title: 'The weak spot', text: '5 kg is too light for the lats. A doorway pull-up bar is the best first purchase; pull-ups would replace the table row and the pullover.' },
]

export const REST_SECONDS = 150

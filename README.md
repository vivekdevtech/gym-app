# Gym Plan App

A simple offline workout planner app that I built for my college gym.

## Why I built it

My college gym has limited equipment and no trainer. The gym apps on the Play Store and the routines on YouTube assume a fully equipped gym, so they did not fit what I actually have. I wanted an organized weekly plan built around my own equipment, so I made my own app.

## Features

- Monday to Sunday plan with a different focus each day (push, pull, legs, rest)
- Each exercise has variants, so I can pick the one that matches the equipment available
- Warm-up checklist before every workout
- Set-by-set ticks with an automatic rest timer (add 15 seconds or skip), with beep and vibration
- Progress bar for the current workout
- Screen stays awake during a workout
- Weekly count, streak, and lifetime totals (workouts, exercises, sets, reps)
- "Easy" button after a workout to raise the weight by 2.5 kg next time (progressive overload)
- Rest day screen with recovery tips
- Works fully offline, data is saved on the device (localStorage)

## Tech stack

- HTML, CSS and vanilla JavaScript
- JSON files for exercises and warm-ups
- Capacitor (https://capacitorjs.com/) to package the web app as an Android APK

## Project structure

```
www/
  index.html
  style.css
  index.js
  exercises.json   (weekly plan, exercises and variants)
  warmup.json      (warm-up lists)
android/           (Capacitor Android project)
```

## Run in the browser

Open the `www` folder in VS Code and start `index.html` with Live Server.

## Build the Android APK

```
npm install
npx cap sync android
cd android
.\gradlew assembleDebug
```

The APK is created at `android/app/build/outputs/apk/debug/app-debug.apk`.

## Customize

The weights in `www/exercises.json` are starting weights based on my own strength and equipment. Change the exercises, sets, reps and weights to match yours.

## Author

Made by Vivek Kumar

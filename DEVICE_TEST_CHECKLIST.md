# Real-Phone Test Checklist

Everything below **cannot be tested from the cloud**. Run it on at least one iPhone and one Android phone before inviting testers. ~20 minutes per phone.

**Setup:** install Expo Go → in `mobile/` run `npm install && npm start` → scan the QR code.

## 1. First run
- [ ] App opens to "What do you want eating to do for you?" in under 3 seconds
- [ ] Finish setup with **Peanuts** + **Vegetarian**
- [ ] Lands on "What should I eat?"

## 2. Daily use
- [ ] Each of Home / Takeout / Restaurant / At work / On the go → **Help me decide** shows a meal
- [ ] Out of home: a yellow "Before you eat" box mentions your peanut allergy
- [ ] No meal shown contains meat or peanuts
- [ ] **Something else** repeatedly → eventually "No match right now" with **Start over**
- [ ] **I'll have this** → "Enjoy your …" screen → **Done** returns home with "Have again"
- [ ] Quick double-tap on **I'll have this** does NOT skip the "Enjoy" screen

## 3. Memory
- [ ] Force-quit the app and reopen → goes straight to home, "Have again" still there
- [ ] Preferences → add **Dairy** allergy → a dairy meal disappears from "Have again"

## 4. Phone settings (the parts most likely to look wrong)
- [ ] **Dark mode** on → everything readable
- [ ] **Largest text size** (iOS: Settings → Accessibility → Display & Text Size → Larger Text; Android: Settings → Display → Font size) → nothing cut off or overlapping
- [ ] **VoiceOver** (iOS) / **TalkBack** (Android) on → you can complete setup and get a recommendation using only the screen reader; buttons read sensible names
- [ ] Smallest phone you can find (iPhone SE size) → no text cut off

## 5. New features
- [ ] Home → **Plan my lunch/dinner** → pick a meal → at that meal time, Home shows "Your plan for …" → **Having it** works
- [ ] Preferences → Reminders → tap **Lunch** → phone asks permission once → allow → a reminder arrives at 11:45
- [ ] Turn reminders off → no more reminders
- [ ] Use EatOS for a week → a "Weekly check-in" card appears; **Not now** hides it

## 6. App Lock (needs a real phone — can't be tested in the cloud)
- [ ] Profile → Privacy & security → **App Lock** → Face ID / fingerprint prompt appears → turn on
- [ ] Force-quit and reopen → "EatOS is locked" → unlock with Face ID / fingerprint
- [ ] Cancel Face ID → passcode fallback works
- [ ] Switch to another app for < 5 min → no lock; > 5 min → lock

## 7. Edge cases
- [ ] Airplane mode → app works normally (it needs no internet)
- [ ] Rotate phone → app stays portrait
- [ ] Preferences → **Share my usage summary** → share sheet opens; message has no allergy/diet info
- [ ] Preferences → **Delete all my data** → confirm → back to setup

## Report back
For anything that fails: phone model, OS version, which step, and a screenshot.

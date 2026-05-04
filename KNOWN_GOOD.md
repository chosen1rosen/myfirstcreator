# Known Good States

Before touching any working feature, **tag it first**:
```bash
git tag feature-name-working <commit>
git push origin --tags
```

To roll back to a tag:
```bash
git checkout tags/feature-name-working -- routes/admin-variants.js
# then commit + deploy
```

---

## ✅ Rotation / Variants System
**Tag:** `rotation-working`  
**Commit:** `ce3ebf1`  
**What works:**
- Set Live correctly updates rot_active_id, rot_mode=manual, rot_sequence
- getActiveVariant() serves correct variant in manual mode even with empty sequence
- /admin/variants/rot-debug shows live DB state

---

## ✅ Testimonials Carousel
**Tag:** `testimonials-working`  
**Commit:** `e8c534d` (current HEAD — pending portrait verification)  
**What works (desktop):**
- 3 cards per view, auto-advancing every 3.5s, infinite loop
- Direct iframe embeds (t.me/post?embed=1&mode=tme) — loads immediately
- cardWidth() uses getBoundingClientRect + computed columnGap

**What works (mobile):**
- 1 card per view, full width
- Carousel wrap uses left:50%/translateX(-50%)/width:100vw structure
- Nav arrows hidden, auto-advance only

**Known issues / watch out:**
- Do NOT remove the `left:50%; transform:translateX(-50%); width:100vw` from
  `.testimonials-carousel-wrap` mobile CSS — this is what makes 1-per-view work
- Do NOT add overflow:hidden to `.testimonial-card.tg-card` — clips iframe height
- Do NOT switch back to async `<script>` Telegram widget — use direct iframe only

---

## 🔒 Rules

1. **Tag before you touch.** If a feature is working, tag it before making changes.
2. **One feature at a time.** Don't fix the carousel and rotation in the same PR.
3. **Verify on mobile + desktop before moving on.**
4. **If something breaks, roll back to the tag immediately** — don't iterate on broken code.

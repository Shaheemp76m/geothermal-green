# GEOTHERM-X --- Continuous Scroll Image Sequence Prototype

## Objective

Build **only the core scroll-controlled image sequence experience**. I
will provide three ZIP archives, each containing sequential rendered
images at approximately 30 FPS.

The three archives are consecutive parts of **one continuous
animation**:

1.  ZIP 1 --- first image sequence
2.  ZIP 2 --- continues directly from ZIP 1
3.  ZIP 3 --- continues directly from ZIP 2

The visitor must experience one uninterrupted scroll journey. There must
be no phase reset, separate scroll section, artificial transition,
pause, or jump when one archive ends and the next begins.

For this development stage, do not build a landing page, navigation,
headings, explanatory text, decorative UI, or any other website content.
The image sequence and scrolling are the entire deliverable.

## 1. Inspect the ZIP archives before coding

Inspect all three archives and report:

-   Archive names and intended order
-   Number of images in each archive
-   Image format and dimensions
-   Total number of frames
-   Approximate total duration at 30 FPS
-   Whether filenames are sequential and correctly sortable
-   Whether images are missing, duplicated, unreadable, or corrupted
-   Whether the boundary frames match

Extract the images into:

``` text
public/
  frames/
    sequence-01/
    sequence-02/
    sequence-03/
```

Sort numbered filenames numerically, not alphabetically. For example,
`frame_2` must come before `frame_10`.

Preserve the original frames. Do not crop, stretch, regenerate,
recolour, or alter them.

Create a manifest containing each sequence's frame count, dimensions,
filenames, and ordering.

Do not implement the animation until archive inspection and ordering are
complete.

## 2. Critical requirement: one continuous sequence

Treat all images from the three ZIP archives as **one combined ordered
frame sequence**.

``` text
ZIP 1: frame 001 → frame 002 → ... → final frame
                                              |
                                              v
ZIP 2: first frame → next frame → ... → final frame
                                              |
                                              v
ZIP 3: first frame → next frame → ... → final frame
```

The user must never perceive these as separate phases.

### Shared boundary frames

The final frame of ZIP 1 is intended to be the same visual frame as the
first frame of ZIP 2. Likewise, the final frame of ZIP 2 is intended to
match the first frame of ZIP 3.

Inspect and compare these pairs before combining the sequences.

-   If adjacent boundary images are identical, include the shared image
    only once. Do not display it twice.
-   If they are visually equivalent but have different file encodings or
    tiny pixel differences, inspect them and choose a reliable way to
    avoid a visible jump. Do not silently introduce a dissolve or other
    transition.
-   If they visibly differ, do not invent or generate replacement
    frames. Report the mismatch and identify the exact files that need
    correction.

Preserve chronological order and every unique frame. There must be no
blank frame, duplicated boundary pause, sudden scale change, position
shift, or scroll-progress reset between archives.

## 3. Technology

Use React, Vite, TypeScript, GSAP, GSAP ScrollTrigger, and HTML Canvas.

Use one reusable Canvas renderer driven by one global scroll-progress
value.

Do not convert the image sequences into ordinary videos. Do not use
GIFs, CSS background-image swapping, or three independent scroll
experiences.

## 4. One global scroll mapping

The entire combined frame sequence must map to one continuous scroll
distance.

Let `N` be the total number of unique frames after handling shared
boundary frames, and `progress` be global scroll progress from 0 to 1.

``` ts
const frameIndex = Math.round(progress * (N - 1));

const safeFrameIndex = Math.max(
  0,
  Math.min(N - 1, frameIndex)
);
```

The global scroll progress must never restart when the source archive
changes.

Resolve the global frame index to the correct image using a generated
manifest or precomputed combined frame list.

Scrolling down advances through the combined sequence. Scrolling up
reverses through the exact same frames.

## 5. Canvas rendering

Create a reusable component, such as `ContinuousFrameSequence.tsx`.

Requirements:

-   Render the selected frame onto one HTML Canvas.
-   Preserve each source image's aspect ratio.
-   Use `contain` behaviour: show the entire machinery and never crop
    it.
-   Keep the visual subject consistently centred.
-   Avoid stretching or distortion.
-   Support desktop and mobile viewport sizes.
-   Handle high-DPI screens using `devicePixelRatio`.
-   Resize the canvas without changing image proportions.
-   Avoid redraws when the frame index has not changed.
-   Use an efficient rendering loop such as `requestAnimationFrame`
    where appropriate.

Use consistent canvas sizing and positioning across the entire sequence
so the machinery does not jump or shift when the source archive changes.

## 6. Scroll behaviour

Use GSAP ScrollTrigger to connect page scroll position to global frame
progress.

Requirements:

-   One continuous vertical scroll journey.
-   One global progress value.
-   One continuous frame sequence.
-   Scrolling down advances the animation.
-   Scrolling up reverses it.
-   No autoplay.
-   No separate phase pinning or independent scroll timelines.
-   No progress reset at ZIP boundaries.
-   No artificial transition effects.
-   No sudden jumps or skipped frames caused by incorrect index mapping.

Use a single pinned visual stage if appropriate, with sufficient scroll
distance to explore the full animation comfortably.

The scroll distance should be configurable. Do not assume each archive
needs an equal amount of scroll; map progress across the complete
combined frame count.

Ensure the document has enough scroll distance for the full sequence.
For this prototype, do not add content after the animation.

## 7. Minimal visual presentation

The page should contain only:

-   A full-screen Canvas
-   A plain dark background: `#08090B`
-   The machinery rendered in the centre

Do not add a landing page, hero section, navbar, buttons, headings, text
overlays, phase labels, progress UI, cards, decorative graphics, extra
sections, or unrequested effects.

A small loading indicator is permitted only while the initial frames are
being prepared. Keep it unobtrusive and remove it once the canvas is
ready.

The image sequence itself must be the entire experience.

## 8. Performance and loading

The archives may contain hundreds of high-resolution frames. Avoid
decoding and retaining every full-resolution image in memory at once if
that would cause excessive memory use.

Implement:

-   Initial-frame preloading before the animation becomes interactive
-   Progressive loading of nearby and upcoming frames
-   A bounded image cache or another memory-conscious strategy
-   Background loading without blocking scroll interaction
-   Efficient image decoding where supported
-   Graceful handling of failed or missing frames
-   Cleanup of image references, event listeners, and GSAP
    ScrollTriggers when components unmount

Do not show a blank canvas during normal interaction.

Do not preload all three archives at full resolution immediately if
doing so would cause long initial loading or memory pressure. Load
progressively while preserving smooth scrolling.

If a requested frame is not ready, use a safe rendering strategy that
avoids flashing blank content. Do not permanently substitute the wrong
frame.

## 9. Testing and acceptance criteria

The prototype is complete only when:

1.  The first frame of ZIP 1 appears on initial load.
2.  Scrolling moves through every unique frame in ZIP 1.
3.  The animation continues directly into ZIP 2 without a reset, pause,
    duplicate boundary frame, or visual jump.
4.  The animation continues into ZIP 3 in the same way.
5.  The final frame of ZIP 3 is reached at the end of the continuous
    scroll sequence.
6.  Scrolling upward reverses smoothly through the same combined
    sequence.
7.  No frames are accidentally omitted due to incorrect filename sorting
    or index mapping.
8.  Image proportions remain correct at different viewport sizes.
9.  The machinery is not cropped or stretched.
10. The page works on desktop and mobile.
11. The browser console has no unresolved errors.
12. The production build completes successfully.

Test the archive boundaries explicitly. Do not rely only on watching the
animation from beginning to end.

## 10. Development workflow

### Step 1 --- Archive audit

Inspect the three ZIP files, extract the frames, sort them, count them,
and compare the boundary images.

### Step 2 --- Combined frame manifest

Create one ordered manifest of every unique frame across all three
archives. Handle shared boundary frames as specified above.

### Step 3 --- Canvas prototype

Build the Canvas renderer and test it with a small subset of frames.

### Step 4 --- Global scroll mapping

Connect one global scroll progress value to the entire combined frame
list.

### Step 5 --- Boundary verification

Test the exact transition from ZIP 1 to ZIP 2 and ZIP 2 to ZIP 3, in
both forward and reverse directions.

### Step 6 --- Performance

Implement progressive preloading, memory management, responsive sizing,
and loading behaviour.

### Step 7 --- Final validation

Test the complete sequence and run the production build.

If archive inspection reveals a problem, stop and report it rather than
guessing.

## Final deliverable

A working, minimal React website that displays the three ZIP archives as
**one seamless, continuous, reversible, scroll-controlled image
sequence**.

The visitor scrolls once through the complete animation:

**ZIP 1 → ZIP 2 → ZIP 3**

There are no separate phases from the visitor's perspective. There is no
reset or transition between archives. The final frame of one archive
connects directly to the first unique frame of the next.

Build only this core scrolling experience. Do not add any other website
features until this works reliably.

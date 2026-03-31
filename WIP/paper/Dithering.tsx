OSMO Supply - Loaders Collection
Scraped from https://www.osmo.supply/vault/loaders
5 Loaders Resources
1. Willem Loading Animation
Category: Loaders | Last Updated: February 12, 2026
Tags: Loading, Animation, Text Reveal, Stagger, Image
Original Source: Dennis Snellenberg
External Scripts
<script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js"></script>
HTML
<section class="willem-header is--loading is--hidden">
    <div class="willem-loader">
        <div class="willem__h1">
            <div class="willem__h1-start">
                <span class="willem__letter">W</span>
                <span class="willem__letter">i</span>
                <span class="willem__letter">l</span>
            </div>
            <div class="willem-loader__box">
                <div class="willem-loader__box-inner">
                    <div class="willem__growing-image">
                        <div class="willem__growing-image-wrap">
                            <img class="willem__cover-image-extra is--1" src="..." loading="lazy" alt="">
                            <img class="willem__cover-image-extra is--2" src="..." loading="lazy" alt="">
                            <img class="willem__cover-image-extra is--3" src="..." loading="lazy" alt="">
                            <img class="willem__cover-image" src="..." loading="lazy" alt="">
                        </div>
                    </div>
                </div>
            </div>
            <div class="willem__h1-end">
                <span class="willem__letter">l</span>
                <span class="willem__letter">e</span>
                <span class="willem__letter">m</span>
            </div>
        </div>
    </div>
    <div class="willem-header__content">
        <div class="willem-header__top"><nav class="willen-nav">...</nav></div>
        <div class="willem-header__bottom">
            <div class="willem__h1">
                <span class="willem__letter-white">W</span>
                <span class="willem__letter-white">i</span>
                <span class="willem__letter-white">l</span>
                <span class="willem__letter-white">l</span>
                <span class="willem__letter-white">e</span>
                <span class="willem__letter-white">m </span>
                <span class="willem__letter-white is--space">©</span>
            </div>
        </div>
    </div>
</section>
CSS
main:has(.willem-header.is--loading) { height: 100dvh; }
.willem-header { color: #f4f4f4; position: relative; overflow: hidden; }
.willem-header.is--loading.is--hidden { display: none; }
.willem-loader { color: #201d1d; justify-content: center; align-items: center; width: 100%; height: 100%; display: flex; position: absolute; top: 0; left: 0; overflow: hidden; }
.willem__h1 { white-space: nowrap; justify-content: center; font-size: 12.5em; font-weight: 500; line-height: .75; display: flex; position: relative; }
.willem__h1-start { justify-content: flex-end; width: 1.5256em; display: flex; overflow: hidden; }
.willem__h1-end { justify-content: flex-start; width: 1.525em; display: flex; overflow: hidden; }
.willem__letter { display: block; position: relative; }
.willem-loader__box { flex-flow: column; justify-content: center; align-items: center; width: 0; display: flex; position: relative; }
.willem-loader__box-inner { justify-content: center; align-items: center; min-width: 1em; height: 95%; display: flex; position: relative; }
.willem__growing-image { justify-content: center; align-items: center; width: 0%; height: 100%; display: flex; position: absolute; overflow: hidden; }
.willem__growing-image-wrap { width: 100%; min-width: 1em; height: 100%; position: absolute; }
.willem__cover-image { pointer-events: none; object-fit: cover; user-select: none; width: 100%; height: 100%; position: absolute; top: 0; left: 0; }
.willem__cover-image-extra { pointer-events: none; object-fit: cover; user-select: none; width: 100%; height: 100%; position: absolute; top: 0; left: 0; }
.willem__cover-image-extra.is--1 { z-index: 3; }
.willem__cover-image-extra.is--2 { z-index: 2; }
.willem__cover-image-extra.is--3 { z-index: 1; }
.willem-header__content { flex-flow: column; justify-content: space-between; align-items: center; width: 100%; min-height: 100dvh; padding: 3em; display: flex; position: relative; }
@media screen and (max-width: 991px) { .willem__h1 { font-size: 9em; } }
@media screen and (max-width: 767px) { .willem__h1 { font-size: 5.5em; } }
JavaScript
function initWillemLoadingAnimation() {
    const container = document.querySelector(".willem-header");
    const loadingLetter = container.querySelectorAll(".willem__letter");
    const box = container.querySelectorAll(".willem-loader__box");
    const growingImage = container.querySelectorAll(".willem__growing-image");
    const headingStart = container.querySelectorAll(".willem__h1-start");
    const headingEnd = container.querySelectorAll(".willem__h1-end");
    const coverImageExtra = container.querySelectorAll(".willem__cover-image-extra");
    const headerLetter = container.querySelectorAll(".willem__letter-white");
    const navLinks = container.querySelectorAll(".willen-nav a");
    const tl = gsap.timeline({ defaults: { ease: "expo.inOut" }, onStart: () => { container.classList.remove('is--hidden'); } });
    if (loadingLetter) { tl.from(loadingLetter, { yPercent: 100, stagger: 0.025, duration: 1.25 }); }
    if (box.length) { tl.fromTo(box, { width: "0em" }, { width: "1em", duration: 1.25 }, "< 1.25"); }
    if (box.length) { tl.fromTo(growingImage, { width: "0%" }, { width: "100%", duration: 1.25 }, "<"); }
    if (headingStart.length) { tl.fromTo(headingStart, { x: "0em" }, { x: "-0.05em", duration: 1.25 }, "<"); }
    if (headingEnd.length) { tl.fromTo(headingEnd, { x: "0em" }, { x: "0.05em", duration: 1.25 }, "<"); }
    if (coverImageExtra.length) { tl.fromTo(coverImageExtra, { opacity: 1 }, { opacity: 0, duration: 0.05, ease: "none", stagger: 0.5 }, "-=0.05"); }
    if (growingImage.length) { tl.to(growingImage, { width: "100vw", height: "100dvh", duration: 2 }, "< 1.25"); }
    if (box.length) { tl.to(box, { width: "110vw", duration: 2 }, "<"); }
    if (headerLetter.length) { tl.from(headerLetter, { yPercent: 100, duration: 1.25, ease: "expo.out", stagger: 0.025 }, "< 1.2"); }
    if (navLinks.length) { tl.from(navLinks, { yPercent: 100, duration: 1.25, ease: "expo.out", stagger: 0.1 }, "<"); }
}
document.addEventListener('DOMContentLoaded', () => { initWillemLoadingAnimation(); });
Implementation Notes
Uses GSAP timeline with expo.inOut easing, directional movement and class toggles. Classes .is--hidden and .is--loading control header visibility on load. Uses Osmo Scaling System (optional extra).
___
2. Crisp Loading Animation
Category: Loaders | Last Updated: February 12, 2026
Tags: Loading, Animation, Timeline, GSAP, Easing, Image, 3D, SplitText
Original Source: Dennis Snellenberg
External Scripts
<script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/SplitText.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/CustomEase.min.js"></script>
HTML
<section data-slideshow="wrap" class="crisp-header is--loading is--hidden">
    <div class="crisp-header__slider">
        <div class="crisp-header__slider-list">
            <div data-slideshow="slide" class="crisp-header__slider-slide is--current"><img class="crisp-header__slider-slide-inner" src="..." alt="..." data-slideshow="parallax" draggable="false"></div>
            <!-- Additional slides follow same pattern -->
        </div>
    </div>
    <div class="crisp-loader">
        <div class="crisp-loader__wrap">
            <div class="crisp-loader__groups">
                <div class="crisp-loader__group is--duplicate">
                    <div class="crisp-loader__single"><div class="crisp-loader__media"><img loading="eager" src="..." alt="..." class="crisp-loader__cover-img"></div></div>
                    <!-- Additional singles -->
                </div>
                <div class="crisp-loader__group is--relative">
                    <div class="crisp-loader__single"><div class="crisp-loader__media is--scaling is--radius"><img loading="eager" src="..." alt="..." class="crisp-loader__cover-img"></div></div>
                    <!-- Additional singles with is--scale-down -->
                </div>
            </div>
            <div class="crisp-loader__fade"></div>
            <div class="crisp-loader__fade is--duplicate"></div>
        </div>
    </div>
    <div class="crisp-header__content">
        <div class="crisp-header__top"><!-- nav --></div>
        <div class="crisp-header__center"><h1 class="crisp-header__h1">We just love pixels</h1></div>
        <div class="crisp-header__bottom">
            <div class="crisp-header__slider-nav">
                <div data-slideshow="thumb" class="crisp-header__slider-nav-btn is--current"><img src="..." class="crisp-loader__cover-img"></div>
                <!-- Additional thumbs -->
            </div>
            <p class="crisp-header__p">Crisp Loading Animation</p>
        </div>
    </div>
</section>
CSS
main:has(.crisp-header.is--loading) { height: 100dvh; }
.crisp-loader { justify-content: center; align-items: center; width: 100%; height: 100%; font-size: 1vw; display: flex; position: absolute; top: 0; left: 0; overflow: hidden; }
.crisp-loader__wrap { font-size: var(--size-font); justify-content: center; align-items: center; display: flex; position: relative; }
.crisp-loader__groups { position: relative; overflow: hidden; }
.crisp-loader__group { border-radius: .5em; justify-content: center; align-items: center; display: flex; position: relative; }
.crisp-loader__single { padding-left: 1em; padding-right: 1em; position: relative; }
.crisp-loader__media { border-radius: .5em; justify-content: center; align-items: center; width: 10em; height: 10em; display: flex; position: relative; }
.crisp-loader__media.is--scaling { will-change: transform; border-radius: 0; transition-property: border-radius; transition-duration: .5s; transition-timing-function: cubic-bezier(1, 0, 0, 1); display: flex; }
.crisp-loader__cover-img { object-fit: cover; border-radius: inherit; width: 100%; height: 100%; position: absolute; }
.crisp-loader__media.is--scaling.is--radius { border-radius: .5em; }
.crisp-loader__group.is--relative { position: relative; left: 100%; }
.crisp-loader__group.is--duplicate { position: absolute; }
.crisp-loader__cover-img.is--scale-down { will-change: transform; }
.crisp-loader__fade { pointer-events: none; background-image: linear-gradient(90deg, #eaeaea 20%, #0000); width: 5em; height: calc(100% + 2px); position: absolute; top: -1px; left: -1px; }
.crisp-loader__fade.is--duplicate { left: auto; right: -1px; transform: scaleX(-1); }
.crisp-header { background-color: #eaeaea; justify-content: center; align-items: center; display: flex; position: relative; overflow: hidden; }
.crisp-header.is--loading.is--hidden { display: none; }
.crisp-header.is--loading .crisp-header__slider { display: none; }
.crisp-header.is--loading .crisp-loader { display: flex; }
.crisp-loader { display: none; }
.crisp-header__content { color: #f4f4f4; flex-flow: column; justify-content: center; align-items: center; width: 100%; min-height: 100dvh; padding: 2.5em; display: flex; position: relative; }
.crisp-header__top { justify-content: space-between; align-items: center; width: 100%; display: flex; }
.crisp-header__center { width: 100%; padding: 1.5em; position: absolute; left: 0; }
.crisp-header__bottom { grid-column-gap: 2em; grid-row-gap: 2em; flex-flow: column; align-items: center; margin-top: auto; display: flex; }
.crisp-header__slider-list { grid-template-rows: 100%; grid-template-columns: 100%; place-items: center; width: 100%; height: 100%; display: grid; overflow: hidden; }
.crisp-header__slider-nav { grid-column-gap: .5em; grid-row-gap: .5em; padding: 1em; display: flex; position: relative; overflow: hidden; }
.crisp-header__slider-nav-btn { cursor: pointer; border: 1px solid #0000; border-radius: .25em; width: 3.5em; height: 3.5em; position: relative; transition: border-color 0.75s cubic-bezier(0.625, 0.05, 0, 1); }
.crisp-header__slider-nav-btn.is--current { border-color: #f4f4f4; }
.crisp-header__slider-slide { opacity: 0; pointer-events: none; will-change: transform, opacity; grid-area: 1 / 1 / -1 / -1; place-items: center; width: 100%; height: 100%; display: grid; position: relative; overflow: hidden; }
.crisp-header__slider-slide.is--current { opacity: 1; pointer-events: auto; }
.crisp-header__slider-slide-inner { object-fit: cover; will-change: transform; width: 100%; height: 100%; position: absolute; }
.crisp-header__h1 { text-align: center; letter-spacing: -.04em; margin-top: 0; margin-bottom: .125em; font-size: calc(5vw + 5dvh); font-weight: 400; line-height: .95; }
JavaScript
gsap.registerPlugin(SplitText, CustomEase);
CustomEase.create("slideshow-wipe", "0.625, 0.05, 0, 1");
 
function initCrispLoadingAnimation() {
    const container = document.querySelector(".crisp-header");
    const heading = container.querySelectorAll(".crisp-header__h1");
    const revealImages = container.querySelectorAll(".crisp-loader__group > *");
    const isScaleUp = container.querySelectorAll(".crisp-loader__media");
    const isScaleDown = container.querySelectorAll(".crisp-loader__media .is--scale-down");
    const isRadius = container.querySelectorAll(".crisp-loader__media.is--scaling.is--radius");
    const smallElements = container.querySelectorAll(".crisp-header__top, .crisp-header__p");
    const sliderNav = container.querySelectorAll(".crisp-header__slider-nav > *");
 
    const tl = gsap.timeline({ defaults: { ease: "expo.inOut" }, onStart: () => { container.classList.remove('is--hidden'); } });
 
    let split;
    if (heading.length) {
        split = new SplitText(heading, { type: "words", mask: "words" });
        gsap.set(split.words, { yPercent: 110 });
    }
 
    if (revealImages.length) { tl.fromTo(revealImages, { xPercent: 500 }, { xPercent: -500, duration: 2.5, stagger: 0.05 }); }
    if (isScaleDown.length) { tl.to(isScaleDown, { scale: 0.5, duration: 2, stagger: { each: 0.05, from: "edges", ease: "none" }, onComplete: () => { if (isRadius) { isRadius.forEach(el => el.classList.remove('is--radius')); } } }, "-=0.1"); }
    if (isScaleUp.length) { tl.fromTo(isScaleUp, { width: "10em", height: "10em" }, { width: "100vw", height: "100dvh", duration: 2 }, "< 0.5"); }
    if (sliderNav.length) { tl.from(sliderNav, { yPercent: 150, stagger: 0.05, ease: "expo.out", duration: 1 }, "-=0.9"); }
    if (split && split.words.length) { tl.to(split.words, { yPercent: 0, stagger: 0.075, ease: "expo.out", duration: 1 }, "< 0.1"); }
    if (smallElements.length) { tl.from(smallElements, { opacity: 0, ease: "power1.inOut", duration: 0.2 }, "< 0.15"); }
    tl.call(function () { container.classList.remove('is--loading'); }, null, "+=0.45");
}
 
document.addEventListener('DOMContentLoaded', () => { document.fonts.ready.then(() => { initCrispLoadingAnimation(); }); });
 
function initSlideShow(el) {
    const ui = { el, slides: Array.from(el.querySelectorAll('[data-slideshow="slide"]')), inner: Array.from(el.querySelectorAll('[data-slideshow="parallax"]')), thumbs: Array.from(el.querySelectorAll('[data-slideshow="thumb"]')) };
    let current = 0;
    const length = ui.slides.length;
    let animating = false;
    const animationDuration = 1.5;
 
    ui.slides.forEach((slide, index) => slide.setAttribute('data-index', index));
    ui.thumbs.forEach((thumb, index) => thumb.setAttribute('data-index', index));
    ui.slides[current].classList.add('is--current');
    ui.thumbs[current].classList.add('is--current');
 
    function navigate(direction, targetIndex = null) {
        if (animating) return;
        animating = true;
        const previous = current;
        current = targetIndex !== null && targetIndex !== undefined ? targetIndex : direction === 1 ? (current < length - 1 ? current + 1 : 0) : (current > 0 ? current - 1 : length - 1);
        const currentSlide = ui.slides[previous];
        const currentInner = ui.inner[previous];
        const upcomingSlide = ui.slides[current];
        const upcomingInner = ui.inner[current];
 
        gsap.timeline({ defaults: { duration: animationDuration, ease: 'slideshow-wipe' },
            onStart() { upcomingSlide.classList.add('is--current'); ui.thumbs[previous].classList.remove('is--current'); ui.thumbs[current].classList.add('is--current'); },
            onComplete() { currentSlide.classList.remove('is--current'); animating = false; }
        })
        .to(currentSlide, { xPercent: -direction * 100 }, 0)
        .to(currentInner, { xPercent: direction * 75 }, 0)
        .fromTo(upcomingSlide, { xPercent: direction * 100 }, { xPercent: 0 }, 0)
        .fromTo(upcomingInner, { xPercent: -direction * 75 }, { xPercent: 0 }, 0);
    }
 
    ui.thumbs.forEach(thumb => {
        thumb.addEventListener('click', event => {
            const targetIndex = parseInt(event.currentTarget.getAttribute('data-index'), 10);
            if (targetIndex === current || animating) return;
            const direction = targetIndex > current ? 1 : -1;
            navigate(direction, targetIndex);
        });
    });
}
 
document.addEventListener('DOMContentLoaded', () => { document.querySelectorAll('[data-slideshow="wrap"]').forEach(wrap => initSlideShow(wrap)); });
Implementation Notes
Loading Animation: Uses GSAP timeline with expo.inOut easing, directional movement and class toggles. Classes .is--hidden and .is--loading control header visibility on load. GSAP SplitText splits the H1 into words.  Slideshow (optional): Use [data-slideshow="wrap"] on container. [data-slideshow="slide"] on each slide for horizontal GSAP animation with .is--current toggle. [data-slideshow="parallax"] inside slides for parallax offset. [data-slideshow="thumb"] for clickable thumbnails with matching data-index values.
___
3. Logo Reveal Loader
Category: Loaders | Last Updated: February 12, 2026
Tags: Loading, Logos, Reveal, GSAP, Timeline, Animation
Original Source: Ilja van Eck
External Scripts
<script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/CustomEase.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/SplitText.min.js"></script>
HTML
<div data-load-wrap class="loader">
    <div data-load-bg class="loader__bg">
        <div data-load-progress class="loader__bg-bar"></div>
    </div>
    <div data-load-container class="loader__container">
        <div class="loader__logo-wrap">
            <div class="loader__logo-item is--base">
                <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewbox="0 0 178 40" fill="none" class="loader__logo-img"><!-- SVG paths --></svg>
            </div>
            <div data-load-logo class="loader__logo-item is--top">
                <svg xmlns="http://www.w3.org/2000/svg" width="100%" viewbox="0 0 178 40" fill="none" class="loader__logo-img"><!-- SVG paths --></svg>
            </div>
        </div>
        <div class="loader__text-wrap">
            <span data-load-text data-load-reset class="loader__text-el">Hold tight</span>
            <span data-load-text data-load-reset class="loader__text-el">Hi there!</span>
        </div>
    </div>
</div>
CSS
.loader { z-index: 100; color: #fff; width: 100%; height: 100dvh; position: fixed; inset: 0% 0% auto; }
.loader__bg { background-color: #0a0a0a; width: 100%; height: 100%; position: absolute; inset: 0%; }
.loader__container { z-index: 2; flex-flow: column; justify-content: center; align-items: center; width: 100%; height: 100%; display: flex; position: relative; }
.loader__bg-bar { z-index: 1; transform-origin: 0%; transform-style: preserve-3d; background-color: #fff; width: 100%; height: .5em; position: absolute; inset: auto 0% 0%; transform: scale3d(0, 1, 1); }
.loader__logo-wrap { justify-content: center; align-items: center; width: 12em; height: 3em; display: flex; position: relative; }
.loader__logo-item { width: 100%; position: absolute; }
.loader__logo-item.is--base { opacity: .2; }
.loader__logo-item.is--top { -webkit-clip-path: inset(0% 100% 0% 0%); clip-path: inset(0% 100% 0% 0%); }
.loader__logo-img { width: 100%; display: block; }
.loader__text-wrap { flex-flow: column; justify-content: center; align-items: center; display: flex; position: absolute; bottom: 3.5em; }
.loader__text-el { text-transform: uppercase; white-space: nowrap; margin-bottom: -.25em; padding-bottom: .25em; font-family: Haffer Mono, Arial, sans-serif; position: absolute; }
[data-load-reset]{ opacity: 0; }
JavaScript
function initLogoRevealLoader(){
    gsap.registerPlugin(CustomEase, SplitText);
    CustomEase.create("loader", "0.65, 0.01, 0.05, 0.99");
    
    const wrap = document.querySelector("[data-load-wrap]");
    if (!wrap) return;
    
    const container = wrap.querySelector("[data-load-container]");
    const bg = wrap.querySelector("[data-load-bg]");
    const progressBar = wrap.querySelector("[data-load-progress]");
    const logo = wrap.querySelector("[data-load-logo]");
    const textElements = Array.from(wrap.querySelectorAll("[data-load-text]"));
    const resetTargets = Array.from(wrap.querySelectorAll('[data-load-reset]:not([data-load-text])'));
    
    const loadTimeline = gsap.timeline({ defaults: { ease: "loader", duration: 3 } })
        .set(wrap, { display: "block" })
        .to(progressBar, { scaleX: 1 })
        .to(logo, { clipPath: "inset(0% 0% 0% 0%)" }, "<")
        .to(container, { autoAlpha: 0, duration: 0.5 })
        .to(progressBar, { scaleX: 0, transformOrigin: "right center", duration: 0.5 }, "<")
        .add("hideContent", "<")
        .to(bg, { yPercent: -101, duration: 1 }, "hideContent")
        .set(wrap, { display: "none" });
    
    if (resetTargets.length) {
        loadTimeline.set(resetTargets, { autoAlpha: 1 }, 0);
    }
    
    if (textElements.length >= 2) {
        const firstWord = new SplitText(textElements[0], { type: "lines,chars", mask: "lines" });
        const secondWord = new SplitText(textElements[1], { type: "lines,chars", mask: "lines" });
        
        gsap.set([firstWord.chars, secondWord.chars], { autoAlpha: 0, yPercent: 125 });
        gsap.set(textElements, { autoAlpha: 1 });
        
        loadTimeline.to(firstWord.chars, { autoAlpha: 1, yPercent: 0, duration: 0.6, stagger: { each: 0.02 } }, 0);
        loadTimeline.to(firstWord.chars, { autoAlpha: 0, yPercent: -125, duration: 0.4, stagger: { each: 0.02 } }, ">+=0.4");
        loadTimeline.to(secondWord.chars, { autoAlpha: 1, yPercent: 0, duration: 0.6, stagger: { each: 0.02 } }, "<");
        loadTimeline.to(secondWord.chars, { autoAlpha: 0, yPercent: -125, duration: 0.4, stagger: { each: 0.02 } }, "hideContent-=0.5");
    }
}
 
document.addEventListener("DOMContentLoaded", () => { initLogoRevealLoader(); });
Implementation Notes
Duration: The overall timeline length is dynamic, driven by the [data-load-progress] and [data-load-logo] reveals (3s by default via the GSAP timeline defaults object).  Change logo: Uses clip-path reveal on the [data-load-logo] div.  Change logo fill direction: Default is left-to-right via clip-path: inset(0% 100% 0% 0%). For bottom-to-top, set to inset(100% 0% 0% 0%) in CSS.  Progress bar: [data-load-progress] div scales from 0 to 1 on x-axis with left transform-origin.  Text elements: Wrap each text block with [data-load-text]. Designed for two text blocks, split into characters and animated in sequence.  Prevent FOUC: Add [data-load-reset] to elements that shouldn't be visible on load. Set [data-load-reset] { opacity: 0; } in CSS. GSAP sets them visible as the timeline starts.
___
4. Welcoming Words Loader
Category: Loaders | Last Updated: February 12, 2026
Tags: Loading, Animation, GSAP, Words, Reveal
Original Source: Dennis Snellenberg
External Scripts
<script src="https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js"></script>
HTML
<div data-loading-container="" class="loading-container">
    <div class="loading-screen">
        <div data-loading-words="Hello, Bonjour, स्वागत हे, Ciao, Olá, おい, Hallå, Guten tag, Hallo" class="loading-words">
            <div class="loading-words__dot"></div>
            <p data-loading-words-target="" class="loading-words__word">Hello</p>
        </div>
    </div>
</div>
CSS
.loading-container { z-index: 500; pointer-events: none; position: fixed; inset: 0; overflow: hidden; }
.loading-screen { pointer-events: auto; color: #fff; background-color: #000; justify-content: center; align-items: center; width: 100%; height: 100%; display: flex; position: absolute; top: 0; left: 0; }
.loading-words { grid-column-gap: 2em; grid-row-gap: 2em; align-items: center; display: flex; opacity: 0; }
.loading-words__dot { background-color: #fff; border-radius: 50%; width: .75em; height: .75em; }
.loading-words__word { font-size: 4.5em; font-weight: 500; line-height: 1; margin: 0; }
@media screen and (max-width: 767px) { .loading-words { font-size: 2.75vw; } }
Custom CSS
:is(.wf-design-mode, .w-editor) .loading-container { display: none; }
JavaScript
function initWelcomingWordsLoader() {
    const loadingContainer = document.querySelector('[data-loading-container]');
    if (!loadingContainer) return;
    
    const loadingWords = loadingContainer.querySelector('[data-loading-words]');
    const wordsTarget = loadingWords.querySelector('[data-loading-words-target]');
    const words = loadingWords.getAttribute('data-loading-words').split(',').map(w => w.trim());
    
    const tl = gsap.timeline();
    tl.set(loadingWords, { yPercent: 50 });
    tl.to(loadingWords, { opacity: 1, yPercent: 0, duration: 1, ease: "Expo.easeInOut" });
    
    words.forEach(word => {
        tl.call(() => { wordsTarget.textContent = word; }, null, '+=0.15');
    });
    
    tl.to(loadingWords, { opacity: 0, yPercent: -75, duration: 0.8, ease: "Expo.easeIn" });
    tl.to(loadingContainer, { autoAlpha: 0, duration: 0.6, ease: "Power1.easeInOut" }, "+ -0.2");
}
 
document.addEventListener('DOMContentLoaded', () => { initWelcomingWordsLoader(); });
Implementation Notes
Loading Container: Use [data-loading-container] attribute on the main loader wrapper element.  Loading Words: Inside [data-loading-words] attribute, list words/phrases separated by commas. Example: [data-loading-words="Hello, Bonjour, स्वागत हे, Olá"].  Loading Words Target: Include one child element marked with [data-loading-words-target] and the script injects each word into it in sequence.
___
5. Number Loader in 3 Steps
Category: Loaders | Last Updated: February 12, 2026
Tags: Loading, Number, Percentage, Steps, Easing, Transition, Overlay
Original Source: Dennis Snellenberg
External Scripts
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
HTML
<div class="loading-container">
    <div class="loading-screen">
        <div class="loading__progress">
            <div class="loading__progress-inner"></div>
        </div>
        <div class="loading__numbers">
            <div class="loading__number-group is--first">
                <div class="loading__number-wrap"><span class="loading__number">1</span></div>
            </div>
            <div class="loading__number-group is--second">
                <div class="loading__number-wrap"><span class="loading__number">1</span><span class="loading__number">2</span><span class="loading__number">3</span><span class="loading__number">4</span><span class="loading__number">5</span><span class="loading__number">6</span><span class="loading__number">7</span><span class="loading__number">8</span><span class="loading__number">9</span><span class="loading__number">0</span></div>
            </div>
            <div class="loading__number-group is--third">
                <div class="loading__number-wrap"><span class="loading__number">1</span><span class="loading__number">2</span><span class="loading__number">3</span><span class="loading__number">4</span><span class="loading__number">5</span><span class="loading__number">6</span><span class="loading__number">7</span><span class="loading__number">8</span><span class="loading__number">9</span><span class="loading__number">0</span></div>
            </div>
            <div class="loading__percentage-wrap"><span class="loading__percentage">%</span></div>
        </div>
    </div>
</div>
CSS
.loading-screen { pointer-events: auto; background-color: #E2E1DF; width: 100%; height: 100%; display: none; position: absolute; top: 0; left: 0; }
.loading-container { z-index: 200; pointer-events: none; background-color: #E2E1DF; position: fixed; inset: 0; overflow: hidden; }
.loading__progress { width: 1em; height: 100%; position: absolute; bottom: 0; left: 0; }
.loading__progress-inner { transform-origin: bottom; background-color: #ff4c24; width: 100%; height: 100%; position: absolute; top: 0; left: 0; }
.loading__numbers { flex-flow: row; align-items: flex-start; font-size: calc(10vw + 10vh); display: flex; position: absolute; bottom: .1em; left: .23em; }
.loading__number-group { flex-flow: column; height: 1em; display: flex; position: relative; overflow: hidden; }
.loading__number-wrap { will-change: transform; flex-flow: column; display: flex; position: relative; }
.loading__number { text-transform: uppercase; font-family: PP Neue Corp Tight, Arial, sans-serif; font-weight: 700; line-height: 1; position: relative; }
.loading__percentage-wrap { flex-flow: column; justify-content: flex-start; margin-top: .375em; font-size: .3em; display: flex; overflow: hidden; }
.loading__percentage { text-transform: uppercase; will-change: transform; font-family: PP Neue Corp Tight, Arial, sans-serif; font-weight: 700; line-height: 1; position: relative; }
Custom CSS
:is(.wf-design-mode, .wf-editor) .loading-screen { display: block; }
JavaScript
function initLoaderThreeSteps() {
    var tl = gsap.timeline();
    gsap.defaults({ ease: "Expo.easeInOut", duration: 1.2 });
    
    var randomNumbers1 = gsap.utils.random([2, 3, 4]);
    var randomNumbers2 = gsap.utils.random([5, 6]);
    var randomNumbers3 = gsap.utils.random([1, 5]);
    var randomNumbers4 = gsap.utils.random([7, 8, 9]);
    
    tl.set(".loading-screen", { display: "block" });
    tl.set(".loading__progress-inner", { scaleY: 0 });
    tl.set(".loading__number-group.is--first .loading__number-wrap, .loading__percentage", { yPercent: 100 });
    tl.set(".loading__number-group.is--second .loading__number-wrap, .loading__number-group.is--third .loading__number-wrap", { yPercent: 10 });
    
    tl.to(".loading__progress-inner", { scaleY: (randomNumbers1 + "" + randomNumbers3) / 100 });
    tl.to(".loading__percentage", { yPercent: 0 }, "<");
    tl.to(".loading__number-group.is--second .loading__number-wrap", { yPercent: (randomNumbers1 - 1) * -10 }, "<");
    tl.to(".loading__number-group.is--third .loading__number-wrap", { yPercent: (randomNumbers3 - 1) * -10 }, "<");
    
    tl.to(".loading__progress-inner", { scaleY: (randomNumbers2 + "" + randomNumbers4) / 100 });
    tl.to(".loading__number-group.is--second .loading__number-wrap", { yPercent: (randomNumbers2 - 1) * -10 }, "<");
    tl.to(".loading__number-group.is--third .loading__number-wrap", { yPercent: (randomNumbers4 - 1) * -10 }, "<");
    
    tl.to(".loading__progress-inner", { scaleY: 1 });
    tl.to(".loading__number-group.is--second .loading__number-wrap", { yPercent: -90 }, "<");
    tl.to(".loading__number-group.is--third .loading__number-wrap", { yPercent: -90 }, "<");
    tl.to(".loading__number-group.is--first .loading__number-wrap", { yPercent: 0 }, "<");
}
 
document.addEventListener("DOMContentLoaded", () => { initLoaderThreeSteps(); });
Implementation Notes
Uses a 3-step GSAP timeline with Expo.easeInOut easing. Each step animates the progress bar and number columns to random values (step 1: 20-45%, step 2: 57-69%, step 3: 100%). Number groups use yPercent translation to scroll through digit columns. The progress bar scales vertically from bottom using transform-origin: bottom.

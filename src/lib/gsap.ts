import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Flip } from 'gsap/Flip';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';

gsap.registerPlugin(ScrollTrigger, Flip, MotionPathPlugin);

ScrollTrigger.config({
  ignoreMobileResize: true,
  autoRefreshEvents: 'DOMContentLoaded,load',
});

export { gsap, ScrollTrigger, Flip, MotionPathPlugin };

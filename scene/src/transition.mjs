/** Zero-slope endpoints avoid a cut between native idle and the accepted stomp. */
export function transitionWeight(t,duration){if(!(duration>0)||!Number.isFinite(t))return 0;const u=Math.max(0,Math.min(1,t/duration));return u*u*(3-2*u);}

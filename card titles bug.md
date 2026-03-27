  Bug: Card title text doesn't sit correctly. Some letters are too close together and
  others "dip" below the others, the title text also "readjusts" visibly when hovering over cards in the hand.                              
                                                        
  The cards sit in a fan layout at the bottom of the
  viewport (rotated ±10°, transition: transform 0.55s). 
  On hover, the card lifts via Y-translate change.      
  During this transition, the title text inside
  .card-title h3 visibly shifts/readjusts. The issue    
  persists across all themes. This issue is most visible in the retro theme, so that should be the page used for testing.

  The text destruction system (js/destruction.js) splits
   these h3s into <span class="destruct-char"> (display:
   inline-block) and <span class="destruct-word"> spans.
   We already tried adding vertical-align: top to       
  .destruct-char — it didn't fix it.

  Approach: Before digging into code to find the root   
  cause, first write a Playwright test
  (tests/card-hover-test.js) that:
  1. Opens http://localhost:8080 (server assumed running
   on port 8080)
  2. Screenshots a card title before hover
  3. Triggers hover on the card (via pointerover event  
  or adding hover-active class + calling layoutCards()) 
  4. Screenshots the same card title during/after hover 
  5. Pixel-compares the title region between the two    
  screenshots to detect the text shift

  Use this test to confirm the bug exists, then iterate 
  on fixes until the test passes. Key files:
  css/cards.css, css/shared.css:874 (.destruct-char),   
  js/card-hand.js (hover logic around line 470-490),    
  js/destruction.js (text splitting).
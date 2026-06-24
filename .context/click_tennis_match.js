// Click first tennis match card
var card = document.querySelector('#tn2-live-grid .tn2-match-card');
if (card) {
  card.click();
  'clicked card ' + card.dataset.matchId;
} else {
  'no card found';
}

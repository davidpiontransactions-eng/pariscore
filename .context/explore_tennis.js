// Explore tennis page structure
var page = document.querySelector('#page-tennis');
if (!page) { 'NO-TENNIS-PAGE'; }
else {
  var out = {};
  out.id = page.id;
  out.classes = page.className;
  out.childCount = page.children.length;
  
  // Find tournament cards
  var cards = page.querySelectorAll('.tournament-card, .league-card, .tennis-card, .match-card');
  out.cardCount = cards.length;
  
  // Find filter/sort elements
  var filters = page.querySelectorAll('.filter-btn, .sort-btn, .filter-bar, .sort-controls');
  out.filterCount = filters.length;
  
  // Find match rows
  var matches = page.querySelectorAll('.match-row, .tennis-match, .match-item');
  out.matchCount = matches.length;
  
  // First 500 chars of innerHTML
  out.html = page.innerHTML.substring(0, 2000);
  
  JSON.stringify(out);
}

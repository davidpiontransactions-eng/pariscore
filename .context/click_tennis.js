// Click tennis tab
var links = document.querySelectorAll('.nav-links a');
for (var i = 0; i < links.length; i++) {
  if (links[i].textContent.trim().toLowerCase() === 'tennis') {
    links[i].click();
    break;
  }
}

// ─────────────────────────────────────────────────────────────
//  EDIT THIS FILE to change the site's content.
//
//  Photos are referenced by file name, e.g. photo("dsc01705.jpg").
//  To show a caption, add it as a second value: photo("dsc01705.jpg", "Frogfish").
//  Each one needs two web-sized copies:
//    images/web/     — max 2400px long edge (full-screen viewer, slideshow)
//    images/thumbs/  — max 900px long edge (grids and tiles)
//  To add new photos, put the originals in /images and ask Claude to
//  regenerate the web copies — or export them at those sizes yourself.
// ─────────────────────────────────────────────────────────────

const photo = (file, caption = "") => ({
  src: `images/web/${file}`,
  thumb: `images/thumbs/${file}`,
  caption,
});

const SITE = {
  name: "Paul Gough",
  tagline: "Underwater Photography",
  // Contact form key from https://web3forms.com — messages go to the email
  // you registered there. The key is safe to publish; it doesn't reveal your email.
  formKey: "",
  instagram: "https://www.instagram.com/paulgoughie/",
  portrait: "images/web/about-divers.jpg",
};

// Full-screen slideshow on the home page (landscape shots work best)
const HERO = [
  photo("dsc01883.jpg"),
  photo("dsc01898.jpg"),
  photo("dsc01710.jpg"),
  photo("dsc01301.jpg"),
  photo("dsc01594.jpg"),
];

// Galleries — "id" is used in the page link (gallery.html?g=coral)
const GALLERIES = [
  {
    id: "macro",
    title: "Macro",
    blurb: "The small stuff — shrimps, worms, slugs and close-up detail.",
    cover: "images/thumbs/dsc01625.jpg",
    photos: [
      photo("dsc01625.jpg"),
      photo("dsc01717.jpg"),
      photo("dsc01781-1.jpg"),
      photo("dsc01502.jpg"),
      photo("dsc01231.jpg"),
      photo("dsc01306-1.jpg"),
      photo("dsc01807.jpg"),
      photo("dsc01581.jpg"),
      photo("dsc01615.jpg"),
      photo("dsc01721.jpg"),
      photo("dsc01322.jpg"),
      photo("dsc01255.jpg"),
      photo("dsc01819.jpg"),
      photo("dsc01649.jpg"),
      photo("dsc01715.jpg"),
      photo("dsc01226.jpg"),
      photo("dsc01833.jpg"),
      photo("dsc01455.jpg"),
      photo("dsc01497.jpg"),
      photo("dsc01802.jpg"),
      photo("dsc01688.jpg"),
      photo("dsc01653.jpg"),
    ],
  },
  {
    id: "coral",
    title: "Coral",
    blurb: "Corals, sponges, sea fans and anemones.",
    cover: "images/thumbs/dsc01713.jpg",
    photos: [
      photo("dsc01713.jpg"),
      photo("dsc01594.jpg"),
      photo("dsc01337.jpg"),
      photo("dsc01274.jpg"),
      photo("dsc01898.jpg"),
      photo("dsc01320.jpg"),
      photo("dsc01496.jpg"),
      photo("dsc01337-1.jpg"),
      photo("dsc01744.jpg"),
      photo("dsc01281.jpg"),
      photo("dsc01274-1.jpg"),
      photo("dsc01740.jpg"),
      photo("dsc01774.jpg"),
      photo("dsc01274-2.jpg"),
    ],
  },
  {
    id: "animals",
    title: "Animals",
    blurb: "Fish portraits — frogfish, blennies, lionfish and reef residents.",
    cover: "images/thumbs/dsc01705.jpg",
    photos: [
      photo("dsc01705.jpg"),
      photo("dsc01883.jpg"),
      photo("dsc01369.jpg"),
      photo("dsc01710.jpg"),
      photo("dsc01911.jpg"),
      photo("dsc01301.jpg"),
      photo("dsc01303.jpg"),
      photo("img-20260530-wa0020-1.jpg"),
      photo("dsc01734.jpg"),
      photo("dsc01381.jpg"),
      photo("dsc01442.jpg"),
      photo("dsc01680.jpg"),
      photo("dsc01347.jpg"),
      photo("dsc01894.jpg"),
      photo("dsc01683.jpg"),
      photo("dsc01700.jpg"),
      photo("dsc01917.jpg"),
      photo("dsc01694.jpg"),
      photo("dsc01508.jpg"),
      photo("dsc01614.jpg"),
      photo("dsc01672-1.jpg"),
    ],
  },
];

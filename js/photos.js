// ─────────────────────────────────────────────────────────────
//  EDIT THIS FILE to change the site's content.
//
//  Photos are referenced by file name, e.g. photo("dsc01705.jpg", "Frogfish").
//  Each one needs two web-sized copies:
//    images/web/     — max 2400px long edge (full-screen viewer, slideshow)
//    images/thumbs/  — max 900px long edge (grids and tiles)
//  To add new photos, put the originals in /images and ask Claude to
//  regenerate the web copies — or export them at those sizes yourself.
//  Captions are best guesses at species — please check and correct them.
// ─────────────────────────────────────────────────────────────

const photo = (file, caption) => ({
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
  photo("dsc01883.jpg", "Blenny"),
  photo("dsc01898.jpg", "Anemone"),
  photo("dsc01710.jpg", "Frogfish with cleaner shrimp"),
  photo("dsc01301.jpg", "Hamlet"),
  photo("dsc01594.jpg", "Coral"),
];

// Galleries — "id" is used in the page link (gallery.html?g=coral)
const GALLERIES = [
  {
    id: "macro",
    title: "Macro",
    blurb: "The small stuff — shrimps, worms, slugs and close-up detail.",
    cover: "images/thumbs/dsc01625.jpg",
    photos: [
      photo("dsc01625.jpg", "Flamingo tongue"),
      photo("dsc01717.jpg", "Squat anemone shrimp"),
      photo("dsc01781-1.jpg", "Seahorse"),
      photo("dsc01502.jpg", "Cleaner shrimp"),
      photo("dsc01231.jpg", "Feather duster worms"),
      photo("dsc01306-1.jpg", "Isopod on a soldierfish"),
      photo("dsc01807.jpg", "Porcupinefish eye"),
      photo("dsc01581.jpg", "Lettuce sea slug"),
      photo("dsc01615.jpg", "Christmas tree worm"),
      photo("dsc01721.jpg", "Octopus eye"),
      photo("dsc01322.jpg", "Juvenile trunkfish"),
      photo("dsc01255.jpg", "Feather duster worm"),
      photo("dsc01819.jpg", "Feather duster worms"),
      photo("dsc01649.jpg", "Eye detail"),
      photo("dsc01715.jpg", "Fan worm"),
      photo("dsc01226.jpg", "Scallop"),
      photo("dsc01833.jpg", "Eye detail"),
      photo("dsc01455.jpg", "Eel in the sand"),
      photo("dsc01497.jpg", "Feather duster worms"),
      photo("dsc01802.jpg", "Porcupinefish eye"),
      photo("dsc01688.jpg", "Eye detail"),
      photo("dsc01653.jpg", "Basket star"),
    ],
  },
  {
    id: "coral",
    title: "Coral",
    blurb: "Corals, sponges, sea fans and anemones.",
    cover: "images/thumbs/dsc01713.jpg",
    photos: [
      photo("dsc01713.jpg", "Orange cup coral"),
      photo("dsc01594.jpg", "Coral"),
      photo("dsc01337.jpg", "Star coral"),
      photo("dsc01274.jpg", "Coral polyps"),
      photo("dsc01898.jpg", "Anemone"),
      photo("dsc01320.jpg", "Gorgonian polyps"),
      photo("dsc01496.jpg", "Sponge"),
      photo("dsc01337-1.jpg", "Star coral"),
      photo("dsc01744.jpg", "Gorgonian polyps"),
      photo("dsc01281.jpg", "Sponge and polyps"),
      photo("dsc01274-1.jpg", "Coral polyps"),
      photo("dsc01740.jpg", "Sea fan"),
      photo("dsc01774.jpg", "Sponge and polyps"),
      photo("dsc01274-2.jpg", "Coral polyp detail"),
    ],
  },
  {
    id: "animals",
    title: "Animals",
    blurb: "Fish portraits — frogfish, blennies, lionfish and reef residents.",
    cover: "images/thumbs/dsc01705.jpg",
    photos: [
      photo("dsc01705.jpg", "Frogfish"),
      photo("dsc01883.jpg", "Blenny"),
      photo("dsc01369.jpg", "Lionfish"),
      photo("dsc01710.jpg", "Frogfish with cleaner shrimp"),
      photo("dsc01911.jpg", "Blenny portrait"),
      photo("dsc01301.jpg", "Hamlet"),
      photo("dsc01303.jpg", "Juvenile damselfish"),
      photo("img-20260530-wa0020-1.jpg", "Peacock flounder"),
      photo("dsc01734.jpg", "Parrotfish"),
      photo("dsc01381.jpg", "Isopod on a soldierfish"),
      photo("dsc01442.jpg", "Spotted drum"),
      photo("dsc01680.jpg", "Harlequin bass"),
      photo("dsc01347.jpg", "Sharpnose puffer"),
      photo("dsc01894.jpg", "Blenny"),
      photo("dsc01683.jpg", "Goatfish"),
      photo("dsc01700.jpg", "Reef fish"),
      photo("dsc01917.jpg", "Blenny"),
      photo("dsc01694.jpg", "Bass, head-on"),
      photo("dsc01508.jpg", "Wrasse"),
      photo("dsc01614.jpg", "Reef fish"),
      photo("dsc01672-1.jpg", "Trumpetfish"),
    ],
  },
];

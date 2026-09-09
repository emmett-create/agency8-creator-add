// Agency 8 — shared default client list
//
// Previously duplicated separately in background.js and options.js, which
// silently drifted apart over time: options.js had Counter, Fur, Raazi, and
// both Stardust (Working)/(Horoscope) that background.js never got, while
// background.js had Allies of Skin, Dr. Squatch, and Tein that options.js
// never got — plus the same sheet listed as both "Pattern" and "Pattern
// Brands" under two different names. Someone updating one file had no way
// to know the other needed the same edit. One shared file, loaded by both,
// so there's only one place to ever update.
//

// The Google OAuth 2.0 Client ID every teammate needs pasted into the
// options page (Chrome Extension Settings > Google OAuth) for the sourcing
// flow to work at all. It's the exact same public value for everyone — not
// a secret, and not actually a per-person setting — so requiring it to be
// hand-typed on every fresh install (and re-typed if extension storage ever
// gets cleared) was pure recurring support burden: one mistyped character
// produces Google's own opaque "OAuth client was not found" error with no
// hint of what actually went wrong. This is now the built-in default,
// used automatically whenever nothing's been explicitly saved — the options
// page field still lets someone override it if that's ever genuinely needed.
const DEFAULT_OAUTH_CLIENT_ID = "114989930763-me51qk18va6udu4foptojsuhadqg46im.apps.googleusercontent.com";

const DEFAULT_CLIENTS = [
  { name: "Allies of Skin",      id: "1_iPEHJi3HOypcBBHyv9DpMBxgVGryt2KSgqEbwzC3N8" },
  { name: "BORNTOSTANDOUT",      id: "1nsRCoRK9hdbH50rMD9zqp-GGwTpPyEAFWT69_pjVEbg" },
  { name: "Brodo",               id: "13PXK5rMfw2S53AZLU57MhwEfv1TWwQS0LYIE7xZHOx0" },
  { name: "Clare V.",            id: "12t1s81q3vOy_yFdIM-169dKXo_jL_HRr4rovqIVuBUk" },
  { name: "Counter",             id: "1gVSv9Nz4Aucnd_8kd8YkW0AsiIEHpjtYgMRp7R3yOqY" },
  { name: "Dr. Squatch",         id: "1hmz1j7FDgkkmBx7qklTIkeNhZ64bFxIzeLyZ4BJAMu4" },
  { name: "Emma Relief",         id: "1tIs_TonI25q20QEB9perUtIAmgepb4Jd0OY4q3x-EdU" },
  { name: "EvolveTogether",      id: "19EZE0wC_8SdK_ntNbjHz63Zdp4ml9Xf7BYJHtv7Fz9Q" },
  { name: "EvolveTogether Paid — Internal", type: "paid_system", url: "https://a8-paid-system.onrender.com", password: "a8paid123", list_type: "INT", client: "evolvetogether" },
  { name: "EvolveTogether Paid", id: "1wjpKQpMoyVfGErkCNP4wecNa1yd9dClszJyIUeTX-Tw", tab: "Master List (Working)" },
  { name: "Feals",               id: "1x7OyNUkQS8lWvz-jRMlCC99fvROX-B7tDeuGG5PiwvM" },
  { name: "Fur",                 id: "1aYKRBpUFy2rZ7vpAmayfA_AnmW9c4tGKECFF-G1Kd6w" },
  { name: "Gimme Seaweed",       id: "1Gp2wcJSBa5YOZ51nd-FuFg-Dy5otJDJUb3bNQW8ELPw" },
  { name: "Harper Wilde",        id: "1Yyc85gXz45xoILd_EKprK87d2mpvCGx5wguSpt-Bs-M" },
  { name: "Ilia",                id: "1xkOWiPIWnIyho4rhPJze_OuBFQSZS7XUAqR1XAM0jrg" },
  { name: "Kalshi",              id: "1-Rkb-r9wlLQcCuPPaimDSSNvFJc0U3ZqkQ7pm7BDbb8" },
  { name: "Lenox and Sixteenth", id: "1mbK7-TgwBZ8jq46MxTw9wnN985h7pGr-ustMV9AiXlM" },
  { name: "MadeGood",            id: "1HoHwoMgV1iGUBO6M3gD91DbwiK51_5TQKNxYNw7FZrs" },
  { name: "MadeGood Paid — Internal", type: "paid_system", url: "https://a8-paid-system.onrender.com", password: "a8paid123", list_type: "INT", client: "madegood" },
  { name: "Magic Molecule",      id: "1-hl6G1UYmovAkQLUY6toCaYabvG6Wd3uEWuVgIyNBfY" },
  { name: "Magna",               id: "1Id9_j-5yVGMBQXlaQvNcIGEA1PRRMw1V_E4eq8RDYIc", tab: "Organic Gifting Master List" },
  { name: "Magna Creatine List", id: "1Id9_j-5yVGMBQXlaQvNcIGEA1PRRMw1V_E4eq8RDYIc", tab: "Creatine List" },
  { name: "Magna Paid — Internal", type: "paid_system", url: "https://a8-paid-system.onrender.com", password: "a8paid123", list_type: "INT", client: "magna" },
  { name: "Maev",                id: "1QSsL_AK8vaJsGhbgC1kXDUD0eOFRtAR-HuJJoRRNlQQ" },
  { name: "Merit",               id: "1e75T4ZUvG-WBfm-IzCTHUlxT3yfiBx4JMAwBXekTKz4" },
  { name: "Momofuku",            id: "1LYJypTQ7Ti0DwoPbVUGlVNGUx8gQiia9UAzWRyQmxk4", tab: "Master List" },
  { name: "Murad",               id: "1lHSQmip5amibXU3me3UW8MCZTwletlzndX-CeOYqT5M" },
  { name: "Nette",               id: "1dq07ZScfGpzQ2FwK292keRRgKXhetyQyzrt22o3Hd3k" },
  { name: "Pattern Brands",      id: "12QE7GRqXv_LZS7VjaD-jgCgzhMHATrMMVY8sH5ptSvk" },
  { name: "Personal Day",        id: "1luLrAJtMGe0oCRmc-aqmyvF24Osx5gdDCodNDxP8fRo" },
  { name: "Raazi Tea",           id: "1DcybNwr-F6uJMa0xfo29cMBJPNa7-lkMl8YFMP0Sbg0" },
  { name: "Reale Actives",       id: "1dmOV65MU9SM-Otq1lNgk1koIVsk-3jDQfmLGcVN1Hhc" },
  { name: "Roz",                 id: "1e2bZ925S7g13oqNxAkE1LMphBoXJRSZ8elPMKPGVh7M" },
  { name: "Snif",                id: "1-Y5vwy3QlfjZMKbmT7sX7m4HH2Ji4By6ZNkk7t5oiEk" },
  { name: "Squigs",              id: "1uuKOSei2nHd1KD6tDAyGDKIwvV2guhUdcolmIHP2mbw" },
  { name: "Stars + Honey",       id: "1nZUCDXuNPmy_s2H9KisgJPA9gZ_OQsMtY_5q0rsKDRE" },
  { name: "Stardust (Working)",  id: "1Qz6ynzsQX-hf_0s5qxoq_jsztri1uhA25V-qO-c202k", tab: "Master List (working)" },
  { name: "Stardust (Horoscope)", id: "1Qz6ynzsQX-hf_0s5qxoq_jsztri1uhA25V-qO-c202k", tab: "Horoscope Master List" },
  { name: "Stardust Sorority List", id: "1Qz6ynzsQX-hf_0s5qxoq_jsztri1uhA25V-qO-c202k", tab: "Sorority Master List" },
  { name: "Stardust Tarot Mailer", id: "1Qz6ynzsQX-hf_0s5qxoq_jsztri1uhA25V-qO-c202k", tab: "Tarot Mailer Master List" },
  { name: "Stardust Paid — Internal", type: "paid_system", url: "https://a8-paid-system.onrender.com", password: "a8paid123", list_type: "INT", client: "stardust" },
  { name: "SYS",                 id: "1T_PKGEkVaZoazmGotIXqcsI5FcPzKp7J43x87tw7Xck" },
  { name: "SYS Paid — Internal", type: "paid_system", url: "https://a8-paid-system.onrender.com", password: "a8paid123", list_type: "INT", client: "sys" },
  { name: "Tein",                id: "1Enujzezf-kIKSgF9Xkded96yz5txr49gGk7ooMji8t0" },
  { name: "The Absorption Company Master List", id: "1xcVQ2SvbyenVLZnuQcJQBzDGD4xWDpM1kwhPWXw2s7w", tab: "Master List" },
  { name: "TAC WLP-1/Berberine List", id: "1xcVQ2SvbyenVLZnuQcJQBzDGD4xWDpM1kwhPWXw2s7w", tab: "WLP-1/Berberine List" },
  { name: "The Absorption Company (Brand) Paid — Internal", type: "paid_system", url: "https://a8-paid-system.onrender.com", password: "a8paid123", list_type: "INT", client: "tacbrand" },
  { name: "The Absorption Company (Growth) Paid — Internal", type: "paid_system", url: "https://a8-paid-system.onrender.com", password: "a8paid123", list_type: "INT", client: "tacgrowth" },
  { name: "Tilt Beauty",         id: "1PyowbTWyAZ_k86bGBtexotoExcqWmUQgYJloTSUZBC0" },
  { name: "Timebeam",            id: "1kfSRwoUOQSyblpYvdlSiwO_XUX7F2tL9omdcmT9IBzY" },
  { name: "TodayTix",            id: "1en88S03oxxDk9fe37TfIs3Acmcj3j0vetE4NyWP2EHA" },
  { name: "Tushy",               id: "15K-yi3aKwNd8YChBEEgIXAE89_30FR2mILLRcg_fEjE" },
  { name: "U Beauty",            id: "1Clh5lceTRC0bFvUD-o8WPOixanCc6nWxM0xX-HqOzv4" },
];

# Carousel photography

The landing carousel scenes are crops of Unsplash photographs. The Unsplash licence
does not require attribution, but these are the photographers, and the Unsplash ID is
enough to fetch any original again.

| Scene     | Photographer    | Unsplash ID   |
| --------- | --------------- | ------------- |
| `morning` | pparnxoxo       | `uHVI29aSTVc` |
| `run`     | Adam Davis      | `jQRxx47932o` |
| `cook`    | Sincerely Media | `R-J5t4aHj3I` |
| `travel`  | Blake Wisz      | `TcgASSD5G04` |
| `trail`   | Matt Whitacre   | `F4GGnyJ8aiI` |

The cropped `.webp` files in this directory are the committed asset; the full-size
originals are not, because they are large and only an input. `npm run assets:scenes`
reads them from `docs/potential-carousel-pics/`, which is git-ignored — download the
five photographs above into that directory before re-running the crop.

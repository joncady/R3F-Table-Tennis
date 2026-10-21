# Paddle equipment research and prototype choices

Checked against the ITTF 2026 statutes and primary equipment sources on 2026-10-20.

## Color and covering rules

[ITTF 2026 Laws 2.4.3 and 2.4.6](https://db.ittf.com/sites/default/files/public/2026-02/2026_Statutes_v1_consolidated_clean.pdf) require matte surfaces, one black and the other a bright color distinguishable from black and the ball. Sandwich rubber including adhesive must be less than 4.05 mm, subject to technical tolerances. This is a total covering limit, not the sponge-only measurement printed on many products. Ordinary outward-pimpled covering is a separate category and is not offered by this prototype.

[ITTF’s color announcement](https://www.ittf.com/2021/09/30/distinct-difference-new-colours-effect-friday-1st-october-2021/) permits pink, purple/violet, green and blue as alternatives to red, with black retained on the other side. [The current equipment list](https://equipments.ittf.com/) uses these color families for approved physical products. The game offers those five colored-face presets, matte shading and a fixed black reverse face. Digital hex colors are inspired by that palette, not an ITTF product approval or color-space certification. Color has no physics effect.

## Sponge thickness and spin

[Butterfly Tenergy 19](https://shop.butterflyonline.com/Tenergy-19-TN19) offers 1.7, 1.9 and 2.1 mm sponge variants; these provide a compact set of familiar choices for one inverted-rubber family. Actual total rubber plus glue thickness must still meet the covering rule.

[Butterfly’s equipment FAQ](https://www.butterflyonline.com/faq/equipment/) describes thicker sponge as offering greater rebound and spin potential through compression. [DONIC’s equipment guide](https://www.donic.com/kataloge/donic/en/blaetterkatalog/pdf/complete.pdf) distinguishes offensive topspin use from chopping and also discusses topsheet elasticity and hardness. Thickness alone therefore cannot determine every stroke’s spin. These sources support a qualitative prototype tradeoff, not precise numerical coefficients or an unconditional “thicker is better” rule.

## Implemented approximation

Existing upward/downward/sideways brushes generate topspin/backspin/sidespin. Angular velocity changes flight through a bounded Magnus force, decays in flight and modifies table rebound. The new sponge response layers onto that system:

| Sponge | Preset | Fully engaged spin gain | Fully engaged pace gain |
| --- | --- | --- | --- |
| 1.7 mm | Control | 0.92× | 0.97× |
| 1.9 mm | Balanced | 1.00× | 1.00× |
| 2.1 mm | Attack | 1.08× | 1.03× |

These are deliberately small, chosen gameplay multipliers, not measured material parameters. Engagement ramps with brush speed; a stationary block gets no free spin or pace benefit. Existing global spin caps remain. The default 1.9 mm setting reproduces the prior game’s brush and return-arc behavior. Pace adjusts the assisted return arc, while sponge-dependent brush gain also applies to player serve contacts. Surface friction, sponge hardness, real dwell time, rubber type and distinct per-face materials are not yet simulated. The physical validation backlog is [issue #6](https://github.com/joncady/R3F-Table-Tennis/issues/6).

Settings persist locally and apply to either singles mode. Equipment is locked within a match; the setup panel can start a new match to make changes. The AI keeps its original materials and default equipment. Multiplayer equipment selection/synchronization is not exposed yet.

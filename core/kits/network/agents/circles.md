---
description: Proposes who belongs in each circle, for the person to decide.
name: Circles
trigger: { changes: [Circles, Contacts, Mail, Events, LinkedIn, LinkedIn connections] }
runs: { script: skills/circles/run.js }
touches: [Members]
---
Proposes who belongs in each circle, from what is known of each person (their title, company,
address, the rows of the person's modules that name them, how often they are in touch) read
against the person's own words for who belongs. Everyone is read when a circle is new or its
words change; otherwise only people met since the last run. Each circle's proposals wait on one
card, In or Left out; nothing is in a circle until the person says.

# Journey connection-waits: 2026-11-09 19:26

A connection waits for the customer, is not retried, and connects once their step is done

Fresh tenant, model claude-opus-5-5, on Claude Code, Alpha's prompt alone.
**Passed** in 1 s, $0.00.


## 1. Added the made-up connector tenant and connected it for /var/folders/sr/81_5d60n0vn6vyh8pkxhz_vm0000gn/T/alpha-journey-tmp-25Izrz

Took 0.8 s.

- pass: the tenant connection is waiting, says /Your IT has to approve Alpha/ (saw waiting | Your IT has to approve Alpha for the tenant. | person:u_pjjvs73k4f)
- pass: the tenant connection was set up by person (saw waiting | Your IT has to approve Alpha for the tenant. | person:u_pjjvs73k4f)
- pass: rows in Tenant rows: 0 (saw 0)
- pass: errors: 0 (saw 0)

## 2. The scheduler's tick: nothing was due

Took 0.0 s.

- pass: “Tenant: sync” 0 time(s) (saw 0)

## 3. The customer did their step: approved

Took 0.0 s.


## 4. Tried tenant again

Took 0.0 s.

- pass: the tenant connection is connected (saw connected |  | person:u_pjjvs73k4f)
- pass: rows in Tenant rows: 1 (saw 1)
- pass: errors: 0 (saw 0)

## The world after

Tenant rows: Note (text)

- note "Read." [looked_up]

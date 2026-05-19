# MongoDB Performance & Scaling: A Purely Numerical Guide

In database system design, it is common to mix up **Connections per second**, **Active Concurrent Connections**, and **QPS (Queries per Second)**. Looking at this purely from a mathematical and physical hardware perspective, here is exactly how those numbers break down for MongoDB.

---

## Part 1: Connections/Sec vs. Connection Pool Size

You should almost **never** have a high number of *new* connections per second. 

Opening a database connection requires a heavy TCP connection handshake, a TLS cryptographic handshake, and authentication. If your application creates a new connection for every single query, your database will crash at just **150 to 200 connections/sec** because the CPU wastes all its energy shaking hands instead of reading data.



Instead, backend drivers use **Connection Pooling** (e.g., Spring Boot's default Mongo driver pool size is 100). 
* Your application opens 100 persistent connections *once* when it boots up.
* It reuses those same 100 connections over and over again.

> **The Number:** A standard standalone MongoDB server can easily hold **3,000 to 20,000 concurrent idle connections** in its pool. But the number of newly opened connections per second should ideally be **close to 0** after startup.

---

## Part 2: QPS (Queries Per Second) on a Single MongoDB Server

What actually matters for scale is **QPS** (or throughput). How many reads or writes can a single MongoDB instance handle before it chokes?

| Workload Type | Safe Zone (Single Node) | Tipping Point (Scale/Optimize Required) |
| :--- | :--- | :--- |
| **Read QPS** (Indexed) | `< 5,000 QPS` | `> 10,000 to 15,000+ QPS` |
| **Write QPS** (Inserts/Updates) | `< 1,000 QPS` | `> 3,000 to 5,000+ QPS` |

### Why do writes fail sooner?
Reads can look up data in memory (RAM cache) instantly. Writes require writing to the WiredTiger storage engine's cache, locking rows/documents, and occasionally flushing directly to disk storage (hitting physical IOPS limits).

---

## Part 3: When do you actually need Sharding? (The True Numbers)

Sharding is horizontal partitioning—splitting your data across multiple machines. It adds massive architectural complexity, so you **do not** shard just because you have a little bit of traffic. 



You only shard when you hit one of these specific physical walls:

### 1. The Storage Wall (The 2–3 TB Rule)
* **The Number:** Your data size hits **2 Terabytes to 3 Terabytes** on a single server.
* **Why:** At 3 TB, standard operational tasks break. Taking a backup takes hours. Restoring from a backup in a production outage could take days. Index building slows to a crawl. Sharding splits that 3 TB across three machines (1 TB each), allowing operations to run in parallel.

### 2. The Memory Wall (The Working Set Rule)
* **The Parameter:** RAM vs. "Working Set" size.
* **The Tipping Point:** Your active indexes and frequently queried documents (the "working set") grow larger than **60-70% of your server's available RAM**.
* **Why:** If your server has 64 GB of RAM, and your indexes take up 50 GB, MongoDB has no room left to cache documents. It begins reading from the hard drive on every query. Disk access is measured in milliseconds, while RAM is measured in nanoseconds—your database speed instantly drops by a factor of 1,000.

### 3. The Write QPS Wall (The Primary Bottleneck)
* **The Number:** Your continuous write workload consistently stays **above 5,000 to 10,000 writes/sec**.
* **Why:** In a standard MongoDB Replica Set (High Availability setup), you have 1 Primary node and 2 Secondary nodes. **All writes must go to the single Primary node.** You cannot scale writes by adding secondaries. The only way to handle 20,000 writes/sec is to shard, which creates multiple Primary nodes across different machines.

---

## Summary Sizing Guide

```text
[ < 2,000 Write QPS & < 1 TB Data ]   ---> 1 Standalone Server or Replica Set is completely fine.
[ > 15,000 Read QPS ]                 ---> Don't shard yet. Add Read Replicas or place a Redis cache in front.
[ > 3 TB Data OR > 10,000 Write QPS ] ---> Time to Shard.
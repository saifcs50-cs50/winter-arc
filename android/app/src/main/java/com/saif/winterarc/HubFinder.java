package com.saif.winterarc;

import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InterfaceAddress;
import java.net.NetworkInterface;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletionService;
import java.util.concurrent.ExecutorCompletionService;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

/**
 * Finds the Mac hub on whatever network the phone is on: home Wi-Fi, or its own hotspot with the Mac
 * connected. In order: the last known address, the hub's Bonjour announcement, then a scan of the
 * phone's local subnets (a quick pass, then a slower one for networks that answer slowly).
 */
final class HubFinder {

    static final String SERVICE_TYPE = "_winterarc._tcp";
    private static final long BONJOUR_WAIT_MS = 3500;
    private static final int MAX_BODY = 512;
    private static final int SUBNET_PREFIX = 24;
    private static final int READ_TIMEOUT_MS = 1200;
    /** Mobile-data interfaces: the Mac is never on those, and probing them only slows the scan down. */
    private static final String[] CELLULAR_PREFIXES = {"rmnet", "ccmni", "pdp", "clat", "v4-", "tun", "dummy"};

    /** A flood of probes makes some routers and Wi-Fi extenders drop the one that matters, so the second pass is gentler. */
    private static final int[][] PASSES = {
        // threads, connect timeout ms, overall seconds
        {32, 500, 6},
        {12, 1800, 45},
    };

    private HubFinder() {}

    static String find(Context context, int port, String lastHost) {
        if (lastHost != null && !lastHost.isEmpty() && isHub(lastHost, port, 1200)) return lastHost;
        String announced = findByBonjour(context, port);
        if (announced != null) return announced;
        List<String> candidates = candidates(lastHost);
        for (int[] pass : PASSES) {
            String host = scan(candidates, port, pass[0], pass[1], pass[2]);
            if (host != null) return host;
        }
        return null;
    }

    /** Asks the network for the hub's `_winterarc._tcp` announcement and checks whoever answers. */
    private static String findByBonjour(Context context, int port) {
        NsdManager nsd = context.getSystemService(NsdManager.class);
        if (nsd == null) return null;
        LinkedBlockingQueue<String> hosts = new LinkedBlockingQueue<>();
        NsdManager.DiscoveryListener listener = new NsdManager.DiscoveryListener() {
            @Override public void onServiceFound(NsdServiceInfo service) {
                try {
                    nsd.resolveService(service, new NsdManager.ResolveListener() {
                        @Override public void onServiceResolved(NsdServiceInfo info) {
                            InetAddress address = info.getHost();
                            if (address instanceof Inet4Address) hosts.offer(address.getHostAddress());
                        }
                        @Override public void onResolveFailed(NsdServiceInfo info, int errorCode) {}
                    });
                } catch (RuntimeException ignored) {
                    // Android allows one resolve at a time; a second hub announcement can wait for the scan.
                }
            }
            @Override public void onServiceLost(NsdServiceInfo service) {}
            @Override public void onDiscoveryStarted(String type) {}
            @Override public void onDiscoveryStopped(String type) {}
            @Override public void onStartDiscoveryFailed(String type, int errorCode) {}
            @Override public void onStopDiscoveryFailed(String type, int errorCode) {}
        };
        try {
            nsd.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, listener);
            long deadline = System.currentTimeMillis() + BONJOUR_WAIT_MS;
            while (true) {
                long left = deadline - System.currentTimeMillis();
                if (left <= 0) return null;
                String host = hosts.poll(left, TimeUnit.MILLISECONDS);
                if (host == null) return null;
                if (isHub(host, port, 1500)) return host;
            }
        } catch (Exception e) {
            return null;
        } finally {
            try {
                nsd.stopServiceDiscovery(listener);
            } catch (RuntimeException ignored) {
                // Discovery never started, so there is nothing to stop.
            }
        }
    }

    private static String scan(List<String> candidates, int port, int threads, int connectTimeoutMs, int overallSeconds) {
        if (candidates.isEmpty()) return null;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CompletionService<String> results = new ExecutorCompletionService<>(pool);
        List<Future<String>> futures = new ArrayList<>();
        for (String host : candidates) futures.add(results.submit(() -> isHub(host, port, connectTimeoutMs) ? host : null));
        try {
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(overallSeconds);
            for (int i = 0; i < futures.size(); i++) {
                long left = deadline - System.nanoTime();
                if (left <= 0) break;
                Future<String> done = results.poll(left, TimeUnit.NANOSECONDS);
                if (done == null) break;
                String host = done.get();
                if (host != null) return host;
            }
        } catch (Exception ignored) {
            // A failed probe just means that address isn't the hub.
        } finally {
            pool.shutdownNow();
        }
        return null;
    }

    private static boolean isCellular(String name) {
        for (String prefix : CELLULAR_PREFIXES) {
            if (name.startsWith(prefix)) return true;
        }
        return false;
    }

    private static List<String> candidates(String skip) {
        Set<String> hosts = new LinkedHashSet<>();
        try {
            for (NetworkInterface nif : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!nif.isUp() || nif.isLoopback() || isCellular(nif.getName())) continue;
                for (InterfaceAddress ia : nif.getInterfaceAddresses()) {
                    InetAddress address = ia.getAddress();
                    if (!(address instanceof Inet4Address) || !address.isSiteLocalAddress()) continue;
                    addSubnet(hosts, (Inet4Address) address, ia.getNetworkPrefixLength());
                }
            }
        } catch (Exception ignored) {
            // No interfaces means no network; the caller reports "not found".
        }
        hosts.remove(skip);
        return new ArrayList<>(hosts);
    }

    private static void addSubnet(Set<String> hosts, Inet4Address own, int prefix) {
        byte[] b = own.getAddress();
        int ip = ((b[0] & 0xff) << 24) | ((b[1] & 0xff) << 16) | ((b[2] & 0xff) << 8) | (b[3] & 0xff);
        int bits = Math.max(prefix, SUBNET_PREFIX);
        int mask = bits == 32 ? -1 : ~((1 << (32 - bits)) - 1);
        int network = ip & mask;
        int size = 1 << (32 - bits);
        for (int i = 1; i < size - 1; i++) {
            int host = network + i;
            if (host == ip) continue;
            hosts.add(((host >>> 24) & 0xff) + "." + ((host >>> 16) & 0xff) + "." + ((host >>> 8) & 0xff) + "." + (host & 0xff));
        }
    }

    static boolean isHub(String host, int port, int connectTimeoutMs) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL("http://" + host + ":" + port + "/api/hello").openConnection();
            connection.setConnectTimeout(connectTimeoutMs);
            connection.setReadTimeout(READ_TIMEOUT_MS);
            if (connection.getResponseCode() != 200) return false;
            try (InputStream in = connection.getInputStream()) {
                byte[] buffer = new byte[MAX_BODY];
                int read = in.read(buffer);
                String body = read > 0 ? new String(buffer, 0, read, StandardCharsets.UTF_8) : "";
                return body.contains("\"app\":\"winter-arc\"");
            }
        } catch (Exception e) {
            return false;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }
}

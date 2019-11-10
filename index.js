const crypto        = require('crypto');
const fs            = require('fs');
const path          = require('path');
const { promisify } = require('util');
const readdir       = promisify(fs.readdir);
const unlink        = promisify(fs.unlink);

const md5 = (input) => crypto.createHash('md5')
                             .update(input)
                             .digest('hex');

module.exports = (watchPath, options) => {
    options = options || {};

    if ('remove' in options && typeof options.remove !== 'boolean') {
        throw new TypeError('Option "remove" should be a boolean');
    }

    if ('interval' in options && typeof options.interval !== 'number') {
        throw new TypeError('Option "interval" should be a number');
    }

    // Create a hash of the path specified and use as a key for the
    // data storage. This ensures no strange paths in the KVS keys.
    const hashedPath = md5(watchPath);

    return async (porla) => {
        const history = await porla.config.get(`autoadd.${hashedPath}.history`) || [];
        let   timer   = null;

        porla.on('loaded', async () => {
            const tick = async () => {
                const files = await readdir(watchPath);

                for (const file of files) {
                    // We store the md5 hash of the file name in our history state
                    // to avoid storing potentially sensitive file names.

                    const fileHash = md5(file);

                    if (history.includes(fileHash)) {
                        continue;
                    }

                    if (path.extname(file) !== '.torrent') {
                        continue;
                    }

                    const filePath = path.join(watchPath, file);

                    try {
                        porla.addTorrent(filePath);
                    } catch (err) {
                        porla.log.error(`autoadd: Failed to add torrent: ${err}`);
                        continue;
                    }

                    // Remove file if we specify that option. If so, we don't
                    // need to put in in history either.
                    if (options.remove) {
                        try {
                            await unlink(filePath);
                        } catch (err) {
                            porla.log.error(`autoadd: Failed to remove file: ${err}`);
                        }
                    } else {
                        history.push(fileHash);
                    }
                }

                timer = setTimeout(() => tick(), options.interval || 5000);
            }

            // First tick happens immediately. The rest follows the interval
            // specified in options.
            timer = setTimeout(() => tick(), 0);
        });

        porla.on('shutdown', async () => {
            clearTimeout(timer);

            porla.log.info('autoadd: Saving history for %d item(s)', history.length);

            await porla.config.set(`autoadd.${hashedPath}.history`, history);
        });
    };
};

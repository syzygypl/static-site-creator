const AWS = require('aws-sdk');
const request = require('request');

function syzygy__static_site_creator(mainDomain, alternativeNames) {

    const bucketName = mainDomain,
        projectName = mainDomain.replace(/\.szg\.io$/, '');

    const s3 = new AWS.S3();


    process.stdout.write(`Searching for bucket ${bucketName}… `);
    s3.listBuckets().promise().then((data) => {

        const found = data.Buckets.find(bucket => bucket.Name === bucketName);

        if (!found) {
            process.stdout.write('Not found, creating now\n');
            const params = {
                Bucket: bucketName,
                CreateBucketConfiguration: {
                    LocationConstraint: process.env.AWS_REGION || "eu-west-1",
                }
            };

            s3.createBucket(params).promise().then((data) => {
                console.log(data);
                /*
                 data = {
                 Location: "http://examplebucket.s3.amazonaws.com/"
                 }
                 */
            });
        } else {
            process.stdout.write(`✔︎\n`);
        }

        process.stdout.write('Configuring bucket… ');

        return s3.putBucketWebsite({
            Bucket: bucketName,
            WebsiteConfiguration: {
                ErrorDocument: {
                    Key: "error.html"
                },
                IndexDocument: {
                    Suffix: "index.html"
                }
            }
        }).promise().then(() => process.stdout.write(`✔︎\n`));
    }).then(() => {
        const cloudFront = new AWS.CloudFront();
        const targetOriginId = `S3-${bucketName}`;

        process.stdout.write(`Searching for CloudFront Distribution ${targetOriginId}… `);

        return cloudFront.listDistributions().promise().then(async function(data) {
            let found = data.DistributionList.Items.find(distribution => distribution.DefaultCacheBehavior.TargetOriginId === targetOriginId);

            if (!found) {
                process.stdout.write(`Not found, creating… `);
                found = await cloudFront.createDistribution({
                    DistributionConfig: {
                        CallerReference: targetOriginId,
                        Comment: targetOriginId,
                        Aliases: {
                            Quantity: alternativeNames.length,
                            Items: alternativeNames
                        },
                        DefaultCacheBehavior: {
                            ForwardedValues: {
                                Cookies: {
                                    Forward: "none",
                                },
                                QueryString: false,

                            },
                            TargetOriginId: targetOriginId,
                            Compress: true,
                            MinTTL: 0,
                            TrustedSigners: {
                                Enabled: false,
                                Quantity: 0
                            },
                            ViewerProtocolPolicy: 'allow-all',

                        },
                        Enabled: true,
                        Origins: {
                            Quantity: 1,
                            Items: [
                                {
                                    DomainName: `${bucketName}.s3.amazonaws.com`,
                                    Id: targetOriginId,
                                    S3OriginConfig: {
                                        OriginAccessIdentity: '',
                                    }
                                }
                            ]
                        }

                    }
                }).promise();
            }

            process.stdout.write(`✔︎ ${found.DomainName}\n`);

            return found.DomainName;
        })
    }).then(cdnDomain => {
        process.stdout.write(`Forwarding ${projectName}.szg.io domain… `);

        request({
            url: 'https://api.digitalocean.com/v2/domains/szg.io/records',
            method: 'POST',
            json: true,
            headers: {
                Authorization: 'Bearer ' + process.env.DIGITAL_OCEAN_API_KEY
            },
            body: {
                type: "CNAME",
                name: projectName,
                data: cdnDomain + ".",
            },
        }, () => process.stdout.write(`✔︎\n`));
    });

}

module.exports = {
    create: syzygy__static_site_creator
};

FROM victoriametrics/vmagent:latest

VOLUME [ "/vmagentdata" ]

EXPOSE 8429

ENTRYPOINT [ "/vmagent-prod" ]

#remoteWrite.url is where we forward metrics when collected i.e vminsert
#remoteWrite.tmpDataPath is a buffer/write-ahead queue in case vminsert goes down
#remote.streamAggr is the aggregation yaml that we use to apply things like metric aggregation or label normalisation
CMD [ \
  "--remoteWrite.url=http://vminsert:8480/insert/0/prometheus/api/v1/write", \
  "--remoteWrite.tmpDataPath=/vmagentdata", \
  "--remoteWrite.streamAggr.config=/etc/vmagent/aggregations.yml", \
  # drop_input cannot be set in aggregations.yml; it is a CLI-only flag. Positionally maps to remoteWrite.url[0] (vminsert), so raw input is dropped there while vector (url[1]) still receives unmodified metrics
  "--remoteWrite.streamAggr.dropInput", \
  "--remoteWrite.url=http://vector:9090/" \
]